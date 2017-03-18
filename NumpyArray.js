/* jshint esnext: true, expr: true, sub: true */

const NumpyArray = function (...args) {  // header: {descr, fortran_order, shape}
    if (args[0].constructor === ArrayBuffer) this._initializeFromArrayBuffer(...args);
    else this._initializeFromFieldViews(...args);
};

(() => {
    const NA = NumpyArray;
    const proto = NA.prototype;

    const py2JSON = header => {  // Very rough. Transform python expr to JSON
        const parts = [];
        const outerTrans = s => {
            [
                [/'$/, '"'],
                [/False/g, 'false'],
                [/True/g, 'true'],
                [/\(/g, '['],
                [/\)/g, ']'],
                [/,\s*(?=\]|\})/g, '']
            ].forEach((args, i) => s = s.replace(...args));
            return s;
        };

        while (header.length > 0) {
            const outer = parts.length % 2 === 0;
            const m = header.match(outer ? /[\s\S]*?($|')/ : /([\s\S]*?(?!\\)[\s\S]|^)'/);
            if (m === null) return null;
            header = header.slice(m[0].length);
            parts.push(outer ? outerTrans(m[0]) : m[0].replace(/'$/, '"'));
        }
        try {
            return JSON.parse(parts.join(''));
        } catch (e) {
            return null;
        }
    };

    proto._initializeFromArrayBuffer = function (buf, header) {
        const dataOffset = 10 + (new DataView(buf, 8)).getUint16(0, true);
        this.numpyHeader = String.fromCharCode.apply(null,new Uint8Array(buf.slice(10,dataOffset)));
        if (header === undefined) header = py2JSON(this.numpyHeader);
        if (header === null) throw `header "${this.numpyHeader}" could not be parsed`;

        if (header.descr.constructor === String) header.descr = [['value', header.descr]];
        const types = header.descr.map(([field, type], i) => {
            const m = type.match(/^(.*?)(\d+)$/);
            try {return [m[1], parseInt(m[2])];}
            catch (e) {throw `'${type}' is not supported`;}
        });
        const totalWidth = types.reduce((acc, [type, width]) => acc + width, 0);

        const fieldView = j => {
            const [type, width] = types[j];
            const offset = types.slice(0, j).reduce((acc, [type, width]) => acc + width, 0);
            const err = `'${type}${width}' is not supported`;

            const mU = type.match(/^([<\|>])u$/);
            if (mU !== null) {
                if (! (width === 1 || width === 2 || width === 4)) throw err;

                const
                little = mU[1] !== '>',
                dv = new DataView(buf, dataOffset);

                return {
                    1: i => dv.getUint8(i * totalWidth + offset, little),
                    2: i => dv.getUint16(i * totalWidth + offset, little),
                    4: i => dv.getUint32(i * totalWidth + offset, little)
                }[width];
            }

            const mI = type.match(/^([<\|>])i$/);
            if (mI !== null) {
                if (! (width === 1 || width === 2 || width === 4)) throw err;

                const
                little = mI[1] !== '>',
                dv = new DataView(buf, dataOffset);

                return {
                    1: i => dv.getInt8(i * totalWidth + offset, little),
                    2: i => dv.getInt16(i * totalWidth + offset, little),
                    4: i => dv.getInt32(i * totalWidth + offset, little)
                }[width];
            }

            const mF = type.match(/^([<>])f$/);
            if (mF !== null) {
                if (! (width === 4 || width === 8)) throw err;

                const
                little = mF[1] !== '>',
                dv = new DataView(buf, dataOffset);

                return {
                    4: i => dv.getFloat32(i * totalWidth + offset, little),
                    8: i => dv.getFloat64(i * totalWidth + offset, little)
                }[width];
            }

            const mS = type.match(/^\|?[Sa]$/);
            if (mS !== null) {
                return i => String.fromCharCode.apply(
                    null,
                    new Uint8Array(buf.slice(dataOffset + i * totalWidth + offset,
                                             dataOffset + i * totalWidth + offset + width))
                ).replace(/\x00*$/, '');
            }

            throw err;
        };

        this.size = header.shape.reduce((prd, dim) => prd * dim, 1);  // n-D is reshaped into 1-D
        this._fieldViews = header.descr.map(([field, type], i) => [field, fieldView(i)]);
        this.fieldNames = header.descr.map(([field, type], i) => field);
        this._updateGetByIndex();
    };

    proto._initializeFromFieldViews = function (size, _fieldViews) {
        this.size = size;
        this._fieldViews = _fieldViews;
        this.fieldNames = _fieldViews.map(([field, view], i) => field);
        this._updateGetByIndex();
    };

    proto._updateGetByIndex = function () {
        const fv = this._fieldViews;
        if (fv.length === 1) {
            const view = fv[0][1];
            this._getByIndex = i => view(i);
        } else {
            this._getByIndex = i => fv.map(([field, view], j) => view(i));
        }
    };

    proto.get = function (arg) {
        if (arg.constructor === Array) {
            if (arg.reduce((acc, i) => acc && Number.isInteger(i), true)) {
                return arg.map((i, j) => this._getByIndex(i)); 
            }
            return this._getByFields(arg);
        } else if (Number.isInteger(arg)) {
            return this._getByIndex(arg);
        } else {
            return this._getByFields([arg]);
        }
    };

    proto._getByIndex = null;

    proto._getByFields = function (flds) {
        const views_map = new Map(this._fieldViews);
        const new_views = flds.map((fd, i) => {
            if (! views_map.has(fd)) throw `'${fd}' is not a field`;
            return [fd, views_map.get(fd)];
        });
        return new NA(this.size, new_views);
    };

    // Use high order functions (reduce, map, filter...) with [...numpy_array]
    proto[Symbol.iterator] = function* () {  
        for (let i = 0; i < this.size; i++) yield this._getByIndex(i);
    };

    proto.toArray = function () {return [...this];};

    NA.getFromURL = (url, header) => {
        return new Promise((rsl, rjt) => {
            const r = new XMLHttpRequest();
            r.open('GET', url);
            r.responseType = 'arraybuffer';
            r.onload = () => rsl(new NA(r.response, header));
            r.onerror = rjt;
            r.send();
        });
    };
})();
