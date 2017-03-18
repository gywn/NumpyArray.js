# NumpyArray: Binary Numpy data in Javascript

## Description

This package provides a simple interface for loading binary Numpy array data (.npy) from URL and reading them in an elegant fashion. The Numpy data can be single-typed or mixed-typed (aka. structured).

Numpy arrays data ([.npy](https://docs.scipy.org/doc/numpy-dev/neps/npy-format.html)) is usually generated by the Python scientific computing package [Numpy](http://www.numpy.org/).

## Demo

https://gywn.github.io/NumpyArray.js

## Usage

### → `NumpyArray.getFromURL(url[, header])`
Load Numpy arrays data from `url` and return a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) object. Once loaded, the array is given as the first argument for the fulfillment handler.

An optional `header` can be given to describe the structure of the Numpy arrays data. Otherwise the package will try to use the [header object](https://docs.scipy.org/doc/numpy-dev/neps/npy-format.html#format-specification-version-1-0) extracted from the binary data.

`getFromURL` only supports `GET` method.

#### Example
```javascript
const promise = NumpyArray.getFromURL('npy/World Population Density.npy');
promise.then(na => window['na'] = na);
```

### → `new NumpyArray(buf[, header])`
Construct a NumpyArray object directly from an ArrayBuffer object.
#### Example
```javascript
const r = new XMLHttpRequest();
r.open('GET', 'npy/World Population Density.npy');
r.responseType = 'arraybuffer';
r.onload = () => window['na'] = new NumpyArray(r.response);
r.send();
```

### → `.fieldNames`
Return an array of the fields' name. If the array is single-typed, the fieldNames is always `["value"]`, unless overriden by the `header` argument.

#### Example
```javascript
na.fieldNames;  // ["Country", "Population", "Density"]
```

### → `.size`
Return the number of records. If the number of dimensions of the data is higher than 1, it will be flatten according to `header.fortran_order`.

#### Example
```javascript
na.size;  // 197
```

### → `.get(...)`
Extract columns or rows from the data. The returned value is also a NumpyArray object (which is a view on the buffer).

#### Example
```javascript
// Extract columns
na.get('Country').fieldNames  // ["Country"]
na.get(['Density', 'Country']).size  // 197
```
```javascript
// Extract rows
na.get(99)  // ["Liechtenstein", 35236, 219.430419921875]
na.get([195, 196])  // [["Zambia", 13881336, 18.444271087646484],
                    //  ["Zimbabwe", 12084304, 30.93951988220215]]
```

### → `.toArray()`
Return a copy the data as Javascript Array object.

#### Example
```javascript
na.toArray()  // [["Afghanistan", 29835392, 46.0780029296875], ...]
na.get('Country').toArray()  // ["Afghanistan", "Albania", ...]
```

### → `.numpyHeader`
Return the raw bytes of the header from the data. Could be useful if the package failed to extract the header object automatically and thus a `header` object must be given explicitly.

#### Example
```javascript
na.numpyHeader  // "{'descr': [('Country', '|S22'),
                //             ('Population', '<i4'),
                //             ('Density', '<f4')],
                //   'fortran_order': False,
                //   'shape': (197,),
                //  }"
```
