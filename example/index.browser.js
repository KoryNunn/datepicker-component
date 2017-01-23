(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

function init () {
  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i]
    revLookup[code.charCodeAt(i)] = i
  }

  revLookup['-'.charCodeAt(0)] = 62
  revLookup['_'.charCodeAt(0)] = 63
}

init()

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0

  // base64 is 4/3 + up to two characters of the original data
  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],2:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length)
    }
    that.length = length
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  that.write(string, encoding)
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array)
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

function arrayIndexOf (arr, val, byteOffset, encoding) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var foundIndex = -1
  for (var i = byteOffset; i < arrLength; ++i) {
    if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
      if (foundIndex === -1) foundIndex = i
      if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
    } else {
      if (foundIndex !== -1) i -= i - foundIndex
      foundIndex = -1
    }
  }

  return -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  if (Buffer.isBuffer(val)) {
    // special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(this, val, byteOffset, encoding)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset, encoding)
  }

  throw new TypeError('val must be string, number or Buffer')
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"base64-js":1,"ieee754":4,"isarray":5}],3:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],4:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],5:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],6:[function(require,module,exports){
var parseDate = require('./parseDate'),
    doc = require('doc-js'),
    crel = require('crel'),
    defaultCss = require('defaultcss');

defaultCss('datepicker-component', `
    .datepicker-component{
        display: flex;
        display: inline-flex;
        flex-flow: row wrap;
        height: 32px;
    }

    .datepicker-component input{
        height: 32px;
        width: 100%;
        flex: 1;
        padding: 5px;
    }

    .datepicker-component .picker{
        flex: 0 1 32px;
        height: 32px;
        width: 32px;
        position: relative;
        -webkit-appearance: none;
        -moz-appearance: none;
        -ms-appearance: none;
        -o-appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        -ms-appearance: none;
        -o-appearance: none;
        appearance: none;
        box-sizing: border-box;
        border: solid 1px gray;
    }

    .datepicker-component ::-webkit-datetime-edit-day-field,
    .datepicker-component ::-webkit-datetime-edit-month-field,
    .datepicker-component ::-webkit-datetime-edit-year-field,
    .datepicker-component ::-webkit-datetime-edit-text,
    .datepicker-component ::-webkit-inner-spin-button
     {
        color: transparent;
        background: transparent;
        display: none;
        font-size: 1px;
    }

    .datepicker-component ::-webkit-calendar-picker-indicator{
        opacity: 1;
        color: black;
        font-size: 31px;
        padding: 5px;
        margin: 0;
        position: absolute;
        top: 0;
        left:0;
        right:0;
        bottom:0;
    }
`);

module.exports = function(fastn, component, type, settings, children){
    settings.value = settings.value;

    component.extend('_generic', settings, children);
    component.setProperty('date');

    component.getEventElement = function(){
        return component.textInput;
    };

    component.getPropertyElement = function(key){
        if(key === 'class'){
            return component.element;
        }

        return component.textInput && component.textInput.element;
    };

    component.render = function(){
        component.textInput = fastn('input', {
            value: '',
            placeholder: settings.placeholder,
            tabindex: 0,
            onchange: 'value:value'
        }).render();

        component.datePicker = fastn('input', {
            value: null,
            type: 'date',
            class: 'picker',
            tabindex: 0,
            onchange: 'value:value'
        }).render();

        component.element = crel('span', {class: 'datepicker-component'},
            component.textInput.element,
            component.datePicker.element
        );

        component.getEventElement = function(){
            return component.datePicker.element;
        };

        function updateTabIndex(){
            var width = window.innerWidth;

            component.textInput.tabindex(width < 768 ? '-1' : '0');
            component.datePicker.tabindex(width < 768 ? '0' : '-1');
        }

        doc(window).on('resize', updateTabIndex);
        updateTabIndex();

        function focusin(event){
            doc(component.element).addClass('focus');
        }
        function focusout(event){
            doc(component.element).removeClass('focus');
        }

        component.textInput.element.addEventListener('focus', focusin);
        component.textInput.element.addEventListener('blur', focusout);

        component.datePicker.element.addEventListener('click', function(){
            component.textInput.element.focus();
        });

        component.datePicker.on('focus', function(event){
            doc(component.element).addClass('focus');

            setTimeout(function(){
                var openPickerEvent = new window.KeyboardEvent('keydown');
                var method = 'initKeyboardEvent' in openPickerEvent ? 'initKeyboardEvent' : 'initKeyEvent';
                openPickerEvent[method]('keydown', true, true, window, 'F4', 3, true, false, true, false, false);
                component.datePicker.element.dispatchEvent(openPickerEvent);
            }, 0);
        });

        component.datePicker.value.on('change', function(date){
            component.date(date);
            component.textInput.element.focus();
        });

        component.textInput.value.on('change', function(value){
            component.date(parseDate(value));
        });

        component.date.on('change', function(date){
            date = date && new Date(date);
            var noDate = !date || isNaN(date);

            component.textInput.value(noDate ? '' : date.toDateString());
            component.datePicker.value(noDate ? undefined : date);
        });

        component.emit('render');

        return component;
    };

    return component;
};

},{"./parseDate":44,"crel":9,"defaultcss":11,"doc-js":14}],7:[function(require,module,exports){
var createDatePicker = require('../'),
    crel = require('crel');

window.onload = function(){

    // Create a datePicker.
    var datePicker = createDatePicker({
        placeholder: 'Enter a date'
    });

    document.body.appendChild(datePicker.element);
};
},{"../":8,"crel":9}],8:[function(require,module,exports){
var fastn = require('fastn')({
    _generic: require('fastn/genericComponent'),
    text: require('fastn/textComponent'),
    datePicker: require('./datepickerComponent')
});

module.exports = function(settings){
    return fastn('datePicker', settings).attach().render();
};
},{"./datepickerComponent":6,"fastn":25,"fastn/genericComponent":24,"fastn/textComponent":42}],9:[function(require,module,exports){
//Copyright (C) 2012 Kory Nunn

//Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

//The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

/*

    This code is not formatted for readability, but rather run-speed and to assist compilers.

    However, the code's intention should be transparent.

    *** IE SUPPORT ***

    If you require this library to work in IE7, add the following after declaring crel.

    var testDiv = document.createElement('div'),
        testLabel = document.createElement('label');

    testDiv.setAttribute('class', 'a');
    testDiv['className'] !== 'a' ? crel.attrMap['class'] = 'className':undefined;
    testDiv.setAttribute('name','a');
    testDiv['name'] !== 'a' ? crel.attrMap['name'] = function(element, value){
        element.id = value;
    }:undefined;


    testLabel.setAttribute('for', 'a');
    testLabel['htmlFor'] !== 'a' ? crel.attrMap['for'] = 'htmlFor':undefined;



*/

(function (root, factory) {
    if (typeof exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        root.crel = factory();
    }
}(this, function () {
    var fn = 'function',
        obj = 'object',
        nodeType = 'nodeType',
        textContent = 'textContent',
        setAttribute = 'setAttribute',
        attrMapString = 'attrMap',
        isNodeString = 'isNode',
        isElementString = 'isElement',
        d = typeof document === obj ? document : {},
        isType = function(a, type){
            return typeof a === type;
        },
        isNode = typeof Node === fn ? function (object) {
            return object instanceof Node;
        } :
        // in IE <= 8 Node is an object, obviously..
        function(object){
            return object &&
                isType(object, obj) &&
                (nodeType in object) &&
                isType(object.ownerDocument,obj);
        },
        isElement = function (object) {
            return crel[isNodeString](object) && object[nodeType] === 1;
        },
        isArray = function(a){
            return a instanceof Array;
        },
        appendChild = function(element, child) {
          if(!crel[isNodeString](child)){
              child = d.createTextNode(child);
          }
          element.appendChild(child);
        };


    function crel(){
        var args = arguments, //Note: assigned to a variable to assist compilers. Saves about 40 bytes in closure compiler. Has negligable effect on performance.
            element = args[0],
            child,
            settings = args[1],
            childIndex = 2,
            argumentsLength = args.length,
            attributeMap = crel[attrMapString];

        element = crel[isElementString](element) ? element : d.createElement(element);
        // shortcut
        if(argumentsLength === 1){
            return element;
        }

        if(!isType(settings,obj) || crel[isNodeString](settings) || isArray(settings)) {
            --childIndex;
            settings = null;
        }

        // shortcut if there is only one child that is a string
        if((argumentsLength - childIndex) === 1 && isType(args[childIndex], 'string') && element[textContent] !== undefined){
            element[textContent] = args[childIndex];
        }else{
            for(; childIndex < argumentsLength; ++childIndex){
                child = args[childIndex];

                if(child == null){
                    continue;
                }

                if (isArray(child)) {
                  for (var i=0; i < child.length; ++i) {
                    appendChild(element, child[i]);
                  }
                } else {
                  appendChild(element, child);
                }
            }
        }

        for(var key in settings){
            if(!attributeMap[key]){
                element[setAttribute](key, settings[key]);
            }else{
                var attr = attributeMap[key];
                if(typeof attr === fn){
                    attr(element, settings[key]);
                }else{
                    element[setAttribute](attr, settings[key]);
                }
            }
        }

        return element;
    }

    // Used for mapping one kind of attribute to the supported version of that in bad browsers.
    crel[attrMapString] = {};

    crel[isElementString] = isElement;

    crel[isNodeString] = isNode;

    return crel;
}));

},{}],10:[function(require,module,exports){
module.exports = function(val) {
  if (val === null || typeof val === 'boolean') {
    return null
  }
  var d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

},{}],11:[function(require,module,exports){
/* jshint node: true */
'use strict';

/**
  # defaultcss

  A very simple module for creating a little bit of defaultcss.  This is
  really useful if you are creating a small JS widget that you want to be
  completely stylable by the application implementer but would also like it
  to look "kind of ok" if someone want to have a quick play.

  ## How it Works

  The provided css text is injected into the HTML document within the document
  `<head>` prior to any other `<link>` or `<style>` tags.  This ensures that
  any definitions that are made within your provided CSS have ample
  opportunity to be overridden by user defined CSS.

  ## Example Usage

  <<< examples/widget.js

  ## Reference

  ### defaultcss

  ```
  defaultcss(label, csstext)
  ```

  Create a new default `style` element and use the provided `label` to
  generate an id for the element "%label%_defaultstyle".  If an existing
  element with that id is found, then do nothing.

  If not, then create the new element and use the provided `csstext` as
  `innerText` for th element.
**/
module.exports = function(label, text) {
  var styleId = label + '_defaultstyle';

  // look for a DOM element with the style id
  var styleEl = document.getElementById(styleId);

  // find the first <link> or <style> tag within the document head
  var firstStyleDef = document.querySelector('link[rel="stylesheet"],style');

  // if we can find a DOM element with that id, then do nothing as a default
  // style has already been applied
  if (styleEl) {
    return styleEl;
  }

  // otherwise, create a style element
  styleEl = document.createElement('style');
  styleEl.innerHTML = text;

  // insert the style element, in order or preference
  // 1. before the first style related element in the page
  if (firstStyleDef) {
    firstStyleDef.parentNode.insertBefore(styleEl, firstStyleDef);
  }
  // 2. to the end of the HEAD
  else if (document.head) {
    document.head.appendChild(styleEl);
  }
  // 3. as the first element in the body
  else if (document.body && document.body.childNodes.length > 0) {
    document.body.insertBefore(styleEl, document.body.childNodes[0]);
  }
  // 4. in the body
  else if (document.body) {
    document.body.appendChild(styleEl);
  }

  return styleEl;
};

},{}],12:[function(require,module,exports){
'use strict';

var isLeapYear = require('is-leap-year');

var MONTH_NAMES = ["january", "february", "march",
                   "april",   "may",      "june",
                   "july",    "august",   "september",
                   "october", "november", "december"];

var DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

var DAYS_IN_MONTH = [
  31,
  null, // 29 in leap years, otherwise 28
  31,
  30,
  31,
  30,
  31,
  31,
  30,
  31,
  30,
  31
];

exports = module.exports = function parse(str, options) {
  if (typeof options !== 'object') {
    options = {usa: options};
  }
  options = options || {};
  options.usa = options.usa !== undefined ? options.usa : false;
  options.now = options.now !== undefined  ? options.now : new Date();
  options.cutoff = options.cutoff !== undefined ? options.cutoff : 80;

  str = str.trim().toLowerCase();

  return parseNearbyDays(str, options.now) ||
         parseLastThisNext(str, options.now) ||
         parseNumberDate(str, options.usa) ||
         parseNumberDateShortYear(str, options.usa, options.cutoff) ||
         parseNumberDateNoYear(str, options.usa, options.now) ||
         parseWordyDate(str, options.now, options.cutoff) ||
         parseIso8601Date(str);
};

var NUMBER              = /^[0-9]+$/;
var NUMBER_WITH_ORDINAL = /^([0-9]+)(st|nd|rd|th)?$/;
var NUMBER_DATE         = /^(3[0-1]|[1-2][0-9]|0?[1-9])[,\|\\\/\-\. ]+(1[0-2]|0?[1-9])[,\|\\\/\-\. ]+([0-9]{4})$/;
var NUMBER_DATE_USA     = /^(1[0-2]|0?[1-9])[,\|\\\/\-\. ]+(3[0-1]|[1-2][0-9]|0?[1-9])[,\|\\\/\-\. ]+([0-9]{4})$/;
var NUMBER_DATE_SHORT_YEAR         = /^(3[0-1]|[1-2][0-9]|0?[1-9])[,\|\\\/\-\. ]+(1[0-2]|0?[1-9])[,\|\\\/\-\. ]+([0-9]{2})$/;
var NUMBER_DATE_SHORT_YEAR_USA     = /^(1[0-2]|0?[1-9])[,\|\\\/\-\. ]+(3[0-1]|[1-2][0-9]|0?[1-9])[,\|\\\/\-\. ]+([0-9]{2})$/;
var NUMBER_DATE_NO_YEAR   = /^(3[0-1]|[1-2][0-9]|0?[1-9])[,\|\\\/\-\. ]+(1[0-2]|0?[1-9])$/;
var NUMBER_DATE_NO_YEAR_USA     = /^(1[0-2]|0?[1-9])[,\|\\\/\-\. ]+(3[0-1]|[1-2][0-9]|0?[1-9])$/;


var ISO_8601_DATE       = /^([0-9]{4})-?(1[0-2]|0?[1-9])-?(3[0-1]|[1-2][0-9]|0?[1-9])$/;

function addDays(now, numberOfDays) {
  var result = new Date(now * 1 + numberOfDays * 60 * 60 * 24 * 1000);
  return date(result.getFullYear(), result.getMonth(), result.getDate());
}


exports.parseNearbyDays = parseNearbyDays;
function parseNearbyDays(string, now) {
  if (string == 'today') {
    return date(now.getFullYear(), now.getMonth(), now.getDate());;
  } else if (string == 'yesterday') {
    return addDays(now, -1);
  } else if (string == 'tomorrow') {
    return addDays(now, +1);
  } else {
    return null;
  }
}

exports.parseLastThisNext = parseLastThisNext;
function parseLastThisNext(string, now) {
  var tokens = string.split(/[,\s]+/);

  if (['last', 'this', 'next'].indexOf(tokens[0]) >= 0 &&
      DAY_NAMES.indexOf(tokens[1]) >= 0 &&
      tokens.length === 2) {
    var dayDiff = DAY_NAMES.indexOf(tokens[1]) - now.getDay();
    if (dayDiff < 0) dayDiff += 7;

    if (tokens[0] === 'last') return addDays(now, dayDiff - 7);
    if (tokens[0] === 'this') return addDays(now, dayDiff);
    if (tokens[0] === 'next') return addDays(now, dayDiff + 7);
  } else {
    return null;
  }
}

exports.parseNumberDate = parseNumberDate;
function parseNumberDate(str, usa) {
  var match = usa ? NUMBER_DATE_USA.exec(str) : NUMBER_DATE.exec(str);
  if (match) {
    return usa ? date(+match[3], match[1] - 1, +match[2]) : date(+match[3], match[2] - 1, +match[1]);
  } else {
    return null;
  }
}

exports.parseNumberDateShortYear = parseNumberDateShortYear;
function parseNumberDateShortYear(str, usa, cutoff) {
  var match = usa ? NUMBER_DATE_SHORT_YEAR_USA.exec(str) : NUMBER_DATE_SHORT_YEAR.exec(str);
  if (match) {
    var year = (+match[3]);
    if (year > cutoff) year += 1900;
    else year += 2000;
    return usa ? date(year, match[1] - 1, +match[2]) : date(year, match[2] - 1, +match[1]);
  } else {
    return null;
  }
}

exports.parseNumberDateNoYear = parseNumberDateNoYear;
function parseNumberDateNoYear(str, usa, today) {
  var match = usa ? NUMBER_DATE_NO_YEAR_USA.exec(str) : NUMBER_DATE_NO_YEAR.exec(str);
  if (match) {
    var year = today.getFullYear();
    return usa ? date(year, match[1] - 1, +match[2]) : date(year, match[2] - 1, +match[1]);
  } else {
    return null;
  }
}

exports.parseWordyDate = parseWordyDate;
function parseWordyDate(string, today, cutoff) {
  var tokens = string.split(/[,\s]+/);
  if (tokens.length >= 2) {
    var match;
    if (match = tokens[0].match(NUMBER_WITH_ORDINAL)) {
      return parseWordyDateParts(match[1], tokens[1], tokens[2], today, cutoff);
    } else if (match = tokens[1].match(NUMBER_WITH_ORDINAL)) {
      return parseWordyDateParts(match[1], tokens[0], tokens[2], today, cutoff);
    } else {
      return null;
    }
  }
}

function parseWordyDateParts(rawDay, rawMonth, rawYear, today, cutoff) {
  var day = +rawDay;
  var month = monthFromName(rawMonth);
  var year;

  if (rawYear)
    year = rawYear.match(NUMBER) ? rawYear * 1 : null;
  else
    year = today.getFullYear();

  if (year < 100 && year >= cutoff) year += 1900;
  if (year < 100) year += 2000;

  if (!(day && month !== null && year))
    return null;

  return date(year, month, day);
}

function parseIso8601Date(string) {
  var match;
  if (match = ISO_8601_DATE.exec(string)) {
    return date(+match[1], match[2] - 1, +match[3]);
  } else {
    return null;
  }
}

exports.monthFromName = monthFromName;
function monthFromName(month) {
  var monthAbreviations = MONTH_NAMES.map(function (name) { return name.substr(0, month.length); });
  var monthIndex = monthAbreviations.indexOf(month);
  if (monthIndex !== -1 && monthAbreviations.indexOf(month, monthIndex + 1) === -1) {
    return monthIndex;
  }
  return null;
}

exports.date = date;
function date(year, month, day) {
  month++;
  if (month > 12 || month < 1) return null;
  if (day < 1) return null;
  if (month === 2) {
    if (day > (isLeapYear(year) ? 29 : 28)) return null;
  } else if (day > DAYS_IN_MONTH[month - 1]) {
    return null;
  }
  if (month < 10) month = '0' + month;
  if (day < 10) day = '0' + day;

  return year + '-' + month + '-' + day;
}
function getISOString(year, month, day) {
  month++;
  if (month < 10) month = '0' + month;
  if (day < 10) day = '0' + day;
  return year + '-' + month + '-' + day + 'T00:00:00.000Z';
}

},{"is-leap-year":43}],13:[function(require,module,exports){
var doc = {
    document: typeof document !== 'undefined' ? document : null,
    setDocument: function(d){
        this.document = d;
    }
};

var arrayProto = [],
    isList = require('./isList'),
    getTargets = require('./getTargets')(doc.document),
    getTarget = require('./getTarget')(doc.document),
    space = ' ';


///[README.md]

function isIn(array, item){
    for(var i = 0; i < array.length; i++) {
        if(item === array[i]){
            return true;
        }
    }
}

/**

    ## .find

    finds elements that match the query within the scope of target

        //fluent
        doc(target).find(query);

        //legacy
        doc.find(target, query);
*/

function find(target, query){
    target = getTargets(target);
    if(query == null){
        return target;
    }

    if(isList(target)){
        var results = [];
        for (var i = 0; i < target.length; i++) {
            var subResults = doc.find(target[i], query);
            for(var j = 0; j < subResults.length; j++) {
                if(!isIn(results, subResults[j])){
                    results.push(subResults[j]);
                }
            }
        }
        return results;
    }

    return target ? target.querySelectorAll(query) : [];
}

/**

    ## .findOne

    finds the first element that matches the query within the scope of target

        //fluent
        doc(target).findOne(query);

        //legacy
        doc.findOne(target, query);
*/

function findOne(target, query){
    target = getTarget(target);
    if(query == null){
        return target;
    }

    if(isList(target)){
        var result;
        for (var i = 0; i < target.length; i++) {
            result = findOne(target[i], query);
            if(result){
                break;
            }
        }
        return result;
    }

    return target ? target.querySelector(query) : null;
}

/**

    ## .closest

    recurses up the DOM from the target node, checking if the current element matches the query

        //fluent
        doc(target).closest(query);

        //legacy
        doc.closest(target, query);
*/

function closest(target, query){
    target = getTarget(target);

    if(isList(target)){
        target = target[0];
    }

    while(
        target &&
        target.ownerDocument &&
        !is(target, query)
    ){
        target = target.parentNode;
    }

    return target === doc.document && target !== query ? null : target;
}

/**

    ## .is

    returns true if the target element matches the query

        //fluent
        doc(target).is(query);

        //legacy
        doc.is(target, query);
*/

function is(target, query){
    target = getTarget(target);

    if(isList(target)){
        target = target[0];
    }

    if(!target.ownerDocument || typeof query !== 'string'){
        return target === query;
    }

    if(target === query){
        return true;
    }

    var parentless = !target.parentNode;

    if(parentless){
        // Give the element a parent so that .querySelectorAll can be used
        document.createDocumentFragment().appendChild(target);
    }

    var result = arrayProto.indexOf.call(find(target.parentNode, query), target) >= 0;

    if(parentless){
        target.parentNode.removeChild(target);
    }

    return result;
}

/**

    ## .addClass

    adds classes to the target (space separated string or array)

        //fluent
        doc(target).addClass(query);

        //legacy
        doc.addClass(target, query);
*/

function addClass(target, classes){
    target = getTargets(target);

    if(isList(target)){
        for (var i = 0; i < target.length; i++) {
            addClass(target[i], classes);
        }
        return this;
    }
    if(!classes){
        return this;
    }

    var classes = Array.isArray(classes) ? classes : classes.split(space),
        currentClasses = target.classList ? null : target.className.split(space);

    for(var i = 0; i < classes.length; i++){
        var classToAdd = classes[i];
        if(!classToAdd || classToAdd === space){
            continue;
        }
        if(target.classList){
            target.classList.add(classToAdd);
        } else if(!currentClasses.indexOf(classToAdd)>=0){
            currentClasses.push(classToAdd);
        }
    }
    if(!target.classList){
        target.className = currentClasses.join(space);
    }
    return this;
}

/**

    ## .removeClass

    removes classes from the target (space separated string or array)

        //fluent
        doc(target).removeClass(query);

        //legacy
        doc.removeClass(target, query);
*/

function removeClass(target, classes){
    target = getTargets(target);

    if(isList(target)){
        for (var i = 0; i < target.length; i++) {
            removeClass(target[i], classes);
        }
        return this;
    }

    if(!classes){
        return this;
    }

    var classes = Array.isArray(classes) ? classes : classes.split(space),
        currentClasses = target.classList ? null : target.className.split(space);

    for(var i = 0; i < classes.length; i++){
        var classToRemove = classes[i];
        if(!classToRemove || classToRemove === space){
            continue;
        }
        if(target.classList){
            target.classList.remove(classToRemove);
            continue;
        }
        var removeIndex = currentClasses.indexOf(classToRemove);
        if(removeIndex >= 0){
            currentClasses.splice(removeIndex, 1);
        }
    }
    if(!target.classList){
        target.className = currentClasses.join(space);
    }
    return this;
}

function addEvent(settings){
    var target = getTarget(settings.target);
    if(target){
        target.addEventListener(settings.event, settings.callback, false);
    }else{
        console.warn('No elements matched the selector, so no events were bound.');
    }
}

/**

    ## .on

    binds a callback to a target when a DOM event is raised.

        //fluent
        doc(target/proxy).on(events, target[optional], callback);

    note: if a target is passed to the .on function, doc's target will be used as the proxy.

        //legacy
        doc.on(events, target, query, proxy[optional]);
*/

function on(events, target, callback, proxy){

    proxy = getTargets(proxy);

    if(!proxy){
        target = getTargets(target);
        // handles multiple targets
        if(isList(target)){
            var multiRemoveCallbacks = [];
            for (var i = 0; i < target.length; i++) {
                multiRemoveCallbacks.push(on(events, target[i], callback, proxy));
            }
            return function(){
                while(multiRemoveCallbacks.length){
                    multiRemoveCallbacks.pop();
                }
            };
        }
    }

    // handles multiple proxies
    // Already handles multiple proxies and targets,
    // because the target loop calls this loop.
    if(isList(proxy)){
        var multiRemoveCallbacks = [];
        for (var i = 0; i < proxy.length; i++) {
            multiRemoveCallbacks.push(on(events, target, callback, proxy[i]));
        }
        return function(){
            while(multiRemoveCallbacks.length){
                multiRemoveCallbacks.pop();
            }
        };
    }

    var removeCallbacks = [];

    if(typeof events === 'string'){
        events = events.split(space);
    }

    for(var i = 0; i < events.length; i++){
        var eventSettings = {};
        if(proxy){
            if(proxy === true){
                proxy = doc.document;
            }
            eventSettings.target = proxy;
            eventSettings.callback = function(event){
                var closestTarget = closest(event.target, target);
                if(closestTarget){
                    callback(event, closestTarget);
                }
            };
        }else{
            eventSettings.target = target;
            eventSettings.callback = callback;
        }

        eventSettings.event = events[i];

        addEvent(eventSettings);

        removeCallbacks.push(eventSettings);
    }

    return function(){
        while(removeCallbacks.length){
            var removeCallback = removeCallbacks.pop();
            getTarget(removeCallback.target).removeEventListener(removeCallback.event, removeCallback.callback);
        }
    }
}

/**

    ## .off

    removes events assigned to a target.

        //fluent
        doc(target/proxy).off(events, target[optional], callback);

    note: if a target is passed to the .on function, doc's target will be used as the proxy.

        //legacy
        doc.off(events, target, callback, proxy);
*/

function off(events, target, callback, proxy){
    if(isList(target)){
        for (var i = 0; i < target.length; i++) {
            off(events, target[i], callback, proxy);
        }
        return this;
    }
    if(proxy instanceof Array){
        for (var i = 0; i < proxy.length; i++) {
            off(events, target, callback, proxy[i]);
        }
        return this;
    }

    if(typeof events === 'string'){
        events = events.split(space);
    }

    if(typeof callback !== 'function'){
        proxy = callback;
        callback = null;
    }

    proxy = proxy ? getTarget(proxy) : doc.document;

    var targets = typeof target === 'string' ? find(target, proxy) : [target];

    for(var targetIndex = 0; targetIndex < targets.length; targetIndex++){
        var currentTarget = targets[targetIndex];

        for(var i = 0; i < events.length; i++){
            currentTarget.removeEventListener(events[i], callback);
        }
    }
    return this;
}

/**

    ## .append

    adds elements to a target

        //fluent
        doc(target).append(children);

        //legacy
        doc.append(target, children);
*/

function append(target, children){
    var target = getTarget(target),
        children = getTarget(children);

    if(isList(target)){
        target = target[0];
    }

    if(isList(children)){
        for (var i = 0; i < children.length; i++) {
            append(target, children[i]);
        }
        return;
    }

    target.appendChild(children);
}

/**

    ## .prepend

    adds elements to the front of a target

        //fluent
        doc(target).prepend(children);

        //legacy
        doc.prepend(target, children);
*/

function prepend(target, children){
    var target = getTarget(target),
        children = getTarget(children);

    if(isList(target)){
        target = target[0];
    }

    if(isList(children)){
        //reversed because otherwise the would get put in in the wrong order.
        for (var i = children.length -1; i; i--) {
            prepend(target, children[i]);
        }
        return;
    }

    target.insertBefore(children, target.firstChild);
}

/**

    ## .isVisible

    checks if an element or any of its parents display properties are set to 'none'

        //fluent
        doc(target).isVisible();

        //legacy
        doc.isVisible(target);
*/

function isVisible(target){
    var target = getTarget(target);
    if(!target){
        return;
    }
    if(isList(target)){
        var i = -1;

        while (target[i++] && isVisible(target[i])) {}
        return target.length >= i;
    }
    while(target.parentNode && target.style.display !== 'none'){
        target = target.parentNode;
    }

    return target === doc.document;
}

/**

    ## .indexOfElement

    returns the index of the element within it's parent element.

        //fluent
        doc(target).indexOfElement();

        //legacy
        doc.indexOfElement(target);

*/

function indexOfElement(target) {
    target = getTargets(target);
    if(!target){
        return;
    }

    if(isList(target)){
        target = target[0];
    }

    var i = -1;

    var parent = target.parentElement;

    if(!parent){
        return i;
    }

    while(parent.children[++i] !== target){}

    return i;
}


/**

    ## .ready

    call a callback when the document is ready.

    returns -1 if there is no parentElement on the target.

        //fluent
        doc().ready(callback);

        //legacy
        doc.ready(callback);
*/

function ready(callback){
    if(doc.document && (doc.document.readyState === 'complete' || doc.document.readyState === 'interactive')){
        callback();
    }else if(window.attachEvent){
        document.attachEvent("onreadystatechange", callback);
        window.attachEvent("onLoad",callback);
    }else if(document.addEventListener){
        document.addEventListener("DOMContentLoaded",callback,false);
    }
}

doc.find = find;
doc.findOne = findOne;
doc.closest = closest;
doc.is = is;
doc.addClass = addClass;
doc.removeClass = removeClass;
doc.off = off;
doc.on = on;
doc.append = append;
doc.prepend = prepend;
doc.isVisible = isVisible;
doc.ready = ready;
doc.indexOfElement = indexOfElement;

module.exports = doc;
},{"./getTarget":15,"./getTargets":16,"./isList":17}],14:[function(require,module,exports){
var doc = require('./doc'),
    isList = require('./isList'),
    getTargets = require('./getTargets')(doc.document),
    flocProto = [];

function Floc(items){
    this.push.apply(this, items);
}
Floc.prototype = flocProto;
flocProto.constructor = Floc;

function floc(target){
    var instance = getTargets(target);

    if(!isList(instance)){
        if(instance){
            instance = [instance];
        }else{
            instance = [];
        }
    }
    return new Floc(instance);
}

var returnsSelf = 'addClass removeClass append prepend'.split(' ');

for(var key in doc){
    if(typeof doc[key] === 'function'){
        floc[key] = doc[key];
        flocProto[key] = (function(key){
            var instance = this;
            // This is also extremely dodgy and fast
            return function(a,b,c,d,e,f){
                var result = doc[key](this, a,b,c,d,e,f);

                if(result !== doc && isList(result)){
                    return floc(result);
                }
                if(returnsSelf.indexOf(key) >=0){
                    return instance;
                }
                return result;
            };
        }(key));
    }
}
flocProto.on = function(events, target, callback){
    var proxy = this;
    if(typeof target === 'function'){
        callback = target;
        target = this;
        proxy = null;
    }
    doc.on(events, target, callback, proxy);
    return this;
};

flocProto.off = function(events, target, callback){
    var reference = this;
    if(typeof target === 'function'){
        callback = target;
        target = this;
        reference = null;
    }
    doc.off(events, target, callback, reference);
    return this;
};

flocProto.ready = function(callback){
    doc.ready(callback);
    return this;
};

flocProto.addClass = function(className){
    doc.addClass(this, className);
    return this;
};

flocProto.removeClass = function(className){
    doc.removeClass(this, className);
    return this;
};

module.exports = floc;
},{"./doc":13,"./getTargets":16,"./isList":17}],15:[function(require,module,exports){
var singleId = /^#\w+$/;

module.exports = function(document){
    return function getTarget(target){
        if(typeof target === 'string'){
            if(singleId.exec(target)){
                return document.getElementById(target.slice(1));
            }
            return document.querySelector(target);
        }

        return target;
    };
};
},{}],16:[function(require,module,exports){

var singleClass = /^\.\w+$/,
    singleId = /^#\w+$/,
    singleTag = /^\w+$/;

module.exports = function(document){
    return function getTargets(target){
        if(typeof target === 'string'){
            if(singleId.exec(target)){
                // If you have more than 1 of the same id in your page,
                // thats your own stupid fault.
                return [document.getElementById(target.slice(1))];
            }
            if(singleTag.exec(target)){
                return document.getElementsByTagName(target);
            }
            if(singleClass.exec(target)){
                return document.getElementsByClassName(target.slice(1));
            }
            return document.querySelectorAll(target);
        }

        return target;
    };
};
},{}],17:[function(require,module,exports){
module.exports = function isList(object){
    return object != null && typeof object === 'object' && 'length' in object && !('nodeType' in object) && object.self != object; // in IE8, window.self is window, but it is not === window, but it is == window......... WTF!?
}
},{}],18:[function(require,module,exports){
var is = require('./is'),
    GENERIC = '_generic',
    EventEmitter = require('events').EventEmitter,
    slice = Array.prototype.slice;

function flatten(item){
    return Array.isArray(item) ? item.reduce(function(result, element){
        if(element == null){
            return result;
        }
        return result.concat(flatten(element));
    },[]) : item;
}

function attachProperties(object, firm){
    for(var key in this._properties){
        this._properties[key].attach(object, firm);
    }
}

function onRender(){

    // Ensure all bindings are somewhat attached just before rendering
    this.attach(undefined, 0);

    for(var key in this._properties){
        this._properties[key].update();
    }
}

function detachProperties(firm){
    for(var key in this._properties){
        this._properties[key].detach(firm);
    }
}

function destroyProperties(){
    for(var key in this._properties){
        this._properties[key].destroy();
    }
}

function clone(){
    return this.fastn(this.component._type, this.component._settings, this.component._children.filter(function(child){
            return !child._templated;
        }).map(function(child){
            return child.clone();
        })
    );
}

function getSetBinding(newBinding){
    if(!arguments.length){
        return this.binding;
    }

    if(!is.binding(newBinding)){
        newBinding = this.fastn.binding(newBinding);
    }

    if(this.binding && this.binding !== newBinding){
        this.binding.removeListener('change', this.emitAttach);
        newBinding.attach(this.binding._model, this.binding._firm);
    }

    this.binding = newBinding;

    this.binding.on('change', this.emitAttach);
    this.binding.on('detach', this.emitDetach);

    this.emitAttach();

    return this.component;
};

function emitAttach(){
    var newBound = this.binding();
    if(newBound !== this.lastBound){
        this.lastBound = newBound;
        this.scope.attach(this.lastBound);
        this.component.emit('attach', this.scope, 1);
    }
}

function emitDetach(){
    this.component.emit('detach', 1);
}

function getScope(){
    return this.scope;
}

function destroy(){
    if(this.destroyed){
        return;
    }
    this.destroyed = true;

    this.component
        .removeAllListeners('render')
        .removeAllListeners('attach');

    this.component.emit('destroy');
    this.component.element = null;
    this.scope.destroy();
    this.binding.destroy();

    return this.component;
}

function attachComponent(object, firm){
    this.binding.attach(object, firm);
    return this.component;
}

function detachComponent(firm){
    this.binding.detach(firm);
    return this.component;
}

function isDestroyed(){
    return this.destroyed;
}

function setProperty(key, property){

    // Add a default property or use the one already there
    if(!property){
        property = this.component[key] || this.fastn.property();
    }

    this.component[key] = property;
    this.component._properties[key] = property;

    return this.component;
}

function extendComponent(type, settings, children){

    if(type in this.types){
        return this.component;
    }

    if(!(type in this.fastn.components)){

        if(!(GENERIC in this.fastn.components)){
            throw new Error('No component of type "' + type + '" is loaded');
        }

        this.fastn.components._generic(this.fastn, this.component, type, settings, children);

        this.types._generic = true;
    }else{

        this.fastn.components[type](this.fastn, this.component, type, settings, children);
    }

    this.types[type] = true;

    return this.component;
};

function isType(type){
    return type in this.types;
}

function FastnComponent(fastn, type, settings, children){
    var component = this;

    var componentScope = {
        types: {},
        fastn: fastn,
        component: component,
        binding: fastn.binding('.'),
        destroyed: false,
        scope: new fastn.Model(false),
        lastBound: null
    };

    componentScope.emitAttach = emitAttach.bind(componentScope);
    componentScope.emitDetach = emitDetach.bind(componentScope);
    componentScope.binding._default_binding = true;

    component._type = type;
    component._properties = {};
    component._settings = settings || {};
    component._children = children ? flatten(children) : [];

    component.attach = attachComponent.bind(componentScope);
    component.detach = detachComponent.bind(componentScope);
    component.scope = getScope.bind(componentScope);
    component.destroy = destroy.bind(componentScope);
    component.destroyed = isDestroyed.bind(componentScope);
    component.binding = getSetBinding.bind(componentScope);
    component.setProperty = setProperty.bind(componentScope);
    component.clone = clone.bind(componentScope);
    component.children = slice.bind(component._children);
    component.extend = extendComponent.bind(componentScope);
    component.is = isType.bind(componentScope);

    component.binding(componentScope.binding);

    component.on('attach', attachProperties.bind(this));
    component.on('render', onRender.bind(this));
    component.on('detach', detachProperties.bind(this));
    component.on('destroy', destroyProperties.bind(this));

    if(fastn.debug){
        component.on('render', function(){
            if(component.element && typeof component.element === 'object'){
                component.element._component = component;
            }
        });
    }
}
FastnComponent.prototype = Object.create(EventEmitter.prototype);
FastnComponent.prototype.constructor = FastnComponent;
FastnComponent.prototype._fastn_component = true;

module.exports = FastnComponent;
},{"./is":26,"events":3}],19:[function(require,module,exports){
var Enti = require('enti'),
    is = require('./is'),
    firmer = require('./firmer'),
    functionEmitter = require('./functionEmitter'),
    setPrototypeOf = require('setprototypeof'),
    same = require('same-value');

function fuseBinding(){
    var args = Array.prototype.slice.call(arguments);

    var bindings = args.slice(),
        transform = bindings.pop(),
        updateTransform,
        resultBinding = createBinding('result'),
        selfChanging;

    resultBinding._arguments = args;

    if(typeof bindings[bindings.length-1] === 'function' && !is.binding(bindings[bindings.length-1])){
        updateTransform = transform;
        transform = bindings.pop();
    }

    resultBinding._model.removeAllListeners();
    resultBinding._set = function(value){
        if(updateTransform){
            selfChanging = true;
            var newValue = updateTransform(value);
            if(!same(newValue, bindings[0]())){
                bindings[0](newValue);
                resultBinding._change(newValue);
            }
            selfChanging = false;
        }else{
            resultBinding._change(value);
        }
    };

    function change(){
        if(selfChanging){
            return;
        }
        resultBinding(transform.apply(null, bindings.map(function(binding){
            return binding();
        })));
    }

    bindings.forEach(function(binding, index){
        if(!is.binding(binding)){
            binding = createBinding(binding);
            bindings.splice(index,1,binding);
        }
        binding.on('change', change);
        resultBinding.on('detach', binding.detach);
    });

    var lastAttached;
    resultBinding.on('attach', function(object){
        selfChanging = true;
        bindings.forEach(function(binding){
            binding.attach(object, 1);
        });
        selfChanging = false;
        if(lastAttached !== object){
            change();
        }
        lastAttached = object;
    });

    return resultBinding;
}

function createValueBinding(){
    var valueBinding = createBinding('value');
    valueBinding.attach = function(){return valueBinding;};
    valueBinding.detach = function(){return valueBinding;};
    return valueBinding;
}

function bindingTemplate(newValue){
    if(!arguments.length){
        return this.value;
    }

    if(this.binding._fastn_binding === '.'){
        return;
    }

    this.binding._set(newValue);
    return this.binding;
}

function createBinding(path, more){

    if(more){ // used instead of arguments.length for performance
        return fuseBinding.apply(null, arguments);
    }

    if(path == null){
        return createValueBinding();
    }

    var bindingScope = {},
        binding = bindingScope.binding = bindingTemplate.bind(bindingScope),
        destroyed;

    setPrototypeOf(binding, functionEmitter);
    binding.setMaxListeners(10000);
    binding._arguments = [path];
    binding._model = new Enti(false);
    binding._fastn_binding = path;
    binding._firm = -Infinity;

    function modelAttachHandler(data){
        binding._model.attach(data);
        binding._change(binding._model.get(path));
        binding.emit('attach', data, 1);
    }

    function modelDetachHandler(){
        binding._model.detach();
    }

    binding.attach = function(object, firm){

        // If the binding is being asked to attach loosly to an object,
        // but it has already been defined as being firmly attached, do not attach.
        if(firmer(binding, firm)){
            return binding;
        }

        binding._firm = firm;

        var isEnti = Enti.isEnti(object);

        if(isEnti && bindingScope.attachedModel === object){
            return binding;
        }

        if(bindingScope.attachedModel){
            bindingScope.attachedModel.removeListener('attach', modelAttachHandler);
            bindingScope.attachedModel.removeListener('detach', modelDetachHandler);
            bindingScope.attachedModel = null;
        }

        if(isEnti){
            bindingScope.attachedModel = object;
            bindingScope.attachedModel.on('attach', modelAttachHandler);
            bindingScope.attachedModel.on('detach', modelDetachHandler);
            object = object._model;
        }

        if(!(object instanceof Object)){
            object = {};
        }

        if(binding._model._model === object){
            return binding;
        }

        modelAttachHandler(object);

        return binding;
    };

    binding.detach = function(firm){
        if(firmer(binding, firm)){
            return binding;
        }

        bindingScope.value = undefined;
        if(binding._model.isAttached()){
            binding._model.detach();
        }
        binding.emit('detach', 1);
        return binding;
    };
    binding._set = function(newValue){
        if(same(binding._model.get(path), newValue)){
            return;
        }
        if(!binding._model.isAttached()){
            binding._model.attach(binding._model.get('.'));
        }
        binding._model.set(path, newValue);
    };
    binding._change = function(newValue){
        bindingScope.value = newValue;
        binding.emit('change', binding());
    };
    binding.clone = function(keepAttachment){
        var newBinding = createBinding.apply(null, binding._arguments);

        if(keepAttachment){
            newBinding.attach(bindingScope.attachedModel || binding._model._model, binding._firm);
        }

        return newBinding;
    };
    binding.destroy = function(soft){
        if(destroyed){
            return;
        }
        if(soft && binding.listeners('change').length){
            return;
        }
        destroyed = true;
        binding.emit('destroy');
        binding.detach();
        binding._model.destroy();
    };

    binding.destroyed = function(){
        return destroyed;
    };

    if(path !== '.'){
        binding._model.on(path, binding._change);
    }

    return binding;
}

function from(valueOrBinding){
    if(is.binding(valueOrBinding)){
        return valueOrBinding;
    }

    return createBinding()(valueOrBinding);
}

createBinding.from = from;

module.exports = createBinding;
},{"./firmer":22,"./functionEmitter":23,"./is":26,"enti":28,"same-value":31,"setprototypeof":34}],20:[function(require,module,exports){
function insertChild(fastn, container, child, index){
    var currentIndex = container._children.indexOf(child),
        newComponent = fastn.toComponent(child);

    if(newComponent !== child){
        container._children.splice(currentIndex, 1, newComponent);
    }

    if(!~currentIndex || newComponent !== child){
        newComponent.attach(container.scope(), 1);
    }

    if(currentIndex !== index){
        if(~currentIndex){
            container._children.splice(currentIndex, 1);
        }
        container._children.splice(index, 0, newComponent);
    }

    if(container.element){
        if(!newComponent.element){
            newComponent.render();
        }
        container._insert(newComponent.element, index);
        newComponent.emit('insert', container);
    }
}

function getContainerElement(){
    return this.containerElement || this.element;
}

function insert(child, index){
    var childComponent = child,
        container = this.container,
        fastn = this.fastn;

    if(index && typeof index === 'object'){
        childComponent = Array.prototype.slice.call(arguments);
    }

    if(isNaN(index)){
        index = container._children.length;
    }

    if(Array.isArray(childComponent)){
        for (var i = 0; i < childComponent.length; i++) {
            container.insert(childComponent[i], i + index);
        }
    }else{
        insertChild(fastn, container, childComponent, index);
    }

    return container;
}

module.exports = function(fastn, component, type, settings, children){
    component.insert = insert.bind({
        container: component,
        fastn: fastn
    });

    component._insert = function(element, index){
        var containerElement = component.getContainerElement();
        if(!containerElement){
            return;
        }

        if(containerElement.childNodes[index] === element){
            return;
        }

        containerElement.insertBefore(element, containerElement.childNodes[index]);
    };

    component.remove = function(childComponent){
        var index = component._children.indexOf(childComponent);
        if(~index){
            component._children.splice(index,1);
        }

        childComponent.detach(1);

        if(childComponent.element){
            component._remove(childComponent.element);
        }
    };

    component._remove = function(element){
        var containerElement = component.getContainerElement();

        if(!element || !containerElement || element.parentNode !== containerElement){
            return;
        }

        containerElement.removeChild(element);
    };

    component.empty = function(){
        while(component._children.length){
            component.remove(component._children.pop());
        }
    };

    component.replaceChild = function(oldChild, newChild){
        var index = component._children.indexOf(oldChild);

        if(!~index){
            return;
        }

        component.remove(oldChild);
        component.insert(newChild, index);
    };

    component.getContainerElement = getContainerElement.bind(component);

    component.on('render', component.insert.bind(null, component._children, 0));

    component.on('attach', function(model, firm){
        for(var i = 0; i < component._children.length; i++){
            if(fastn.isComponent(component._children[i])){
                component._children[i].attach(model, firm);
            }
        }
    });

    component.on('destroy', function(data, firm){
        for(var i = 0; i < component._children.length; i++){
            if(fastn.isComponent(component._children[i])){
                component._children[i].destroy(firm);
            }
        }
    });

    return component;
};
},{}],21:[function(require,module,exports){
var setify = require('setify'),
    classist = require('classist');

function updateTextProperty(generic, element, value){
    if(arguments.length === 2){
        return element.textContent;
    }
    element.textContent = (value == null ? '' : value);
}

module.exports = {
    class: function(generic, element, value){
        if(!generic._classist){
            generic._classist = classist(element);
        }

        if(arguments.length < 3){
            return generic._classist();
        }

        generic._classist(value);
    },
    display: function(generic, element, value){
        if(arguments.length === 2){
            return element.style.display !== 'none';
        }
        element.style.display = value ? null : 'none';
    },
    disabled: function(generic, element, value){
        if(arguments.length === 2){
            return element.hasAttribute('disabled');
        }
        if(value){
            element.setAttribute('disabled', 'disabled');
        }else{
            element.removeAttribute('disabled');
        }
    },
    textContent: updateTextProperty,
    innerText: updateTextProperty,
    innerHTML: updateTextProperty,
    value: function(generic, element, value){
        var inputType = element.type;

        if(element.nodeName === 'INPUT' && inputType === 'date'){
            if(arguments.length === 2){
                return element.value ? new Date(element.value.replace(/-/g,'/').replace('T',' ')) : null;
            }

            value = value != null ? new Date(value) : null;

            if(!value || isNaN(value)){
                element.value = null;
            }else{
                element.value = [
                    value.getFullYear(),
                    ('0' + (value.getMonth() + 1)).slice(-2),
                    ('0' + value.getDate()).slice(-2)
                ].join('-');
            }
            return;
        }

        if(arguments.length === 2){
            return element.value;
        }
        if(value === undefined){
            value = null;
        }

        setify(element, value);
    },
    style: function(generic, element, value){
        if(arguments.length === 2){
            return element.style;
        }

        for(var key in value){
            element.style[key] = value[key];
        }
    }
};
},{"classist":27,"setify":32}],22:[function(require,module,exports){
// Is the entity firmer than the new firmness
module.exports = function(entity, firm){
    if(firm != null && (entity._firm === undefined || firm < entity._firm)){
        return true;
    }
};
},{}],23:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter,
    functionEmitterPrototype = function(){};

for(var key in EventEmitter.prototype){
    functionEmitterPrototype[key] = EventEmitter.prototype[key];
}

module.exports = functionEmitterPrototype;
},{"events":3}],24:[function(require,module,exports){
var containerComponent = require('./containerComponent'),
    schedule = require('./schedule'),
    fancyProps = require('./fancyProps'),
    matchDomHandlerName = /^((?:el\.)?)([^. ]+)(?:\.(capture))?$/,
    GENERIC = '_generic';

function createProperties(fastn, component, settings){
    for(var key in settings){
        var setting = settings[key];

        if(typeof setting === 'function' && !fastn.isProperty(setting) && !fastn.isBinding(setting)){
            continue;
        }

        component.addDomProperty(key);
    }
}

function addDomHandler(component, element, handlerName, eventName, capture){
    var eventParts = handlerName.split('.');

    if(eventParts[0] === 'on'){
        eventParts.shift();
    }

    var handler = function(event){
            component.emit(handlerName, event, component.scope());
        };

    element.addEventListener(eventName, handler, capture);

    component.on('destroy', function(){
        element.removeEventListener(eventName, handler, capture);
    });
}

function addDomHandlers(component, element, eventNames){
    var events = eventNames.split(' ');

    for(var i = 0; i < events.length; i++){
        var eventName = events[i],
            match = eventName.match(matchDomHandlerName);

        if(!match){
            continue;
        }

        if(match[1] || 'on' + match[2] in element){
            addDomHandler(component, element, eventNames, match[2], match[3]);
        }
    }
}

function addAutoHandler(component, element, key, settings){
    if(!settings[key]){
        return;
    }

    var autoEvent = settings[key].split(':'),
        eventName = key.slice(2);

    delete settings[key];

    var handler = function(event){
        var fancyProp = fancyProps[autoEvent[1]],
            value = fancyProp ? fancyProp(component, element) : element[autoEvent[1]];

        component[autoEvent[0]](value);
    };

    element.addEventListener(eventName, handler);

    component.on('destroy', function(){
        element.removeEventListener(eventName, handler);
    });
}

function addDomProperty(fastn, key, property){
    var component = this;

    property = property || component[key] || fastn.property();
    component.setProperty(key, property);

    function update(){
        var element = component.getPropertyElement(key),
            value = property();

        if(!element || component.destroyed()){
            return;
        }

        var isProperty = key in element,
            fancyProp = fancyProps[key],
            previous = fancyProp ? fancyProp(component, element) : isProperty ? element[key] : element.getAttribute(key);

        if(!fancyProp && !isProperty && value == null){
            value = '';
        }

        if(value !== previous){
            if(fancyProp){
                fancyProp(component, element, value);
                return;
            }

            if(isProperty){
                element[key] = value;
                return;
            }

            if(typeof value !== 'function' && typeof value !== 'object'){
                element.setAttribute(key, value);
            }
        }
    }

    property.updater(update);
}

function onRender(){
    var component = this,
        element;

    for(var key in component._settings){
        element = component.getEventElement(key);
        if(key.slice(0,2) === 'on' && key in element){
            addAutoHandler(component, element, key, component._settings);
        }
    }

    for(var eventKey in component._events){
        element = component.getEventElement(key);
        addDomHandlers(component, element, eventKey);
    }
}

function render(){
    this.element = this.createElement(this._settings.tagName || this._tagName);

    this.emit('render');

    return this;
};

function genericComponent(fastn, component, type, settings, children){
    if(component.is(type)){
        return component;
    }

    if(type === GENERIC){
        component._tagName = component._tagName || 'div';
    }else{
        component._tagName = type;
    }

    if(component.is(GENERIC)){
        return component;
    }

    component.extend('_container', settings, children);

    component.addDomProperty = addDomProperty.bind(component, fastn);
    component.getEventElement = component.getContainerElement;
    component.getPropertyElement = component.getContainerElement;
    component.updateProperty = genericComponent.updateProperty;
    component.createElement = genericComponent.createElement;

    createProperties(fastn, component, settings);

    component.render = render.bind(component);

    component.on('render', onRender);

    return component;
}

genericComponent.updateProperty = function(component, property, update){
    if(typeof document !== 'undefined' && document.contains(component.element)){
        schedule(property, update);
    }else{
        update();
    }
};

genericComponent.createElement = function(tagName){
    if(tagName instanceof Node){
        return tagName;
    }
    return document.createElement(tagName);
};

module.exports = genericComponent;
},{"./containerComponent":20,"./fancyProps":21,"./schedule":41}],25:[function(require,module,exports){
var createProperty = require('./property'),
    createBinding = require('./binding'),
    BaseComponent = require('./baseComponent'),
    crel = require('crel'),
    Enti = require('enti'),
    objectAssign = require('object-assign'),
    is = require('./is');

function inflateProperties(component, settings){
    for(var key in settings){
        var setting = settings[key],
            property = component[key];

        if(is.property(settings[key])){

            if(is.property(property)){
                property.destroy();
            }

            setting.addTo(component, key);

        }else if(is.property(property)){

            if(is.binding(setting)){
                property.binding(setting);
            }else{
                property(setting);
            }

            property.addTo(component, key);
        }
    }
}

function validateExpectedComponents(components, componentName, expectedComponents){
    expectedComponents = expectedComponents.filter(function(componentName){
        return !(componentName in components);
    });

    if(expectedComponents.length){
        console.warn([
            'fastn("' + componentName + '") uses some components that have not been registered with fastn',
            'Expected conponent constructors: ' + expectedComponents.join(', ')
        ].join('\n\n'));
    }
}

module.exports = function(components, debug){

    if(!components || typeof components !== 'object'){
        throw new Error('fastn must be initialised with a components object');
    }

    components._container = components._container || require('./containerComponent');

    function fastn(type){

        var args = [];
        for(var i = 0; i < arguments.length; i++){
            args[i] = arguments[i];
        }

        var settings = args[1],
            childrenIndex = 2,
            settingsChild = fastn.toComponent(args[1]);

        if(Array.isArray(args[1]) || settingsChild || !args[1]){
            args[1] = settingsChild || args[1];
            childrenIndex--;
            settings = null;
        }

        settings = objectAssign({}, settings || {});

        var types = typeof type === 'string' ? type.split(':') : Array.isArray(type) ? type : [type],
            baseType,
            children = args.slice(childrenIndex),
            component = fastn.base(type, settings, children);

        while(baseType = types.shift()){
            component.extend(baseType, settings, children);
        }

        component._properties = {};

        inflateProperties(component, settings);

        return component;
    }

    fastn.toComponent = function(component){
        if(component == null){
            return;
        }
        if(is.component(component)){
            return component;
        }
        if(typeof component !== 'object' || component instanceof Date){
            return fastn('text', {auto: true}, component);
        }
        if(crel.isElement(component)){
            return fastn(component);
        }
        if(crel.isNode(component)){
            return fastn('text', {auto: true}, component.textContent);
        }
    };

    fastn.debug = debug;
    fastn.property = createProperty;
    fastn.binding = createBinding;
    fastn.isComponent = is.component;
    fastn.isBinding = is.binding;
    fastn.isDefaultBinding = is.defaultBinding;
    fastn.isBindingObject = is.bindingObject;
    fastn.isProperty = is.property;
    fastn.components = components;
    fastn.Model = Enti;

    fastn.base = function(type, settings, children){
        return new BaseComponent(fastn, type, settings, children);
    };

    for(var key in components){
        var componentConstructor = components[key];

        if(componentConstructor.expectedComponents){
            validateExpectedComponents(components, key, componentConstructor.expectedComponents);
        }
    }

    return fastn;
};
},{"./baseComponent":18,"./binding":19,"./containerComponent":20,"./is":26,"./property":40,"crel":9,"enti":28,"object-assign":30}],26:[function(require,module,exports){
var FUNCTION = 'function',
    OBJECT = 'object',
    FASTNBINDING = '_fastn_binding',
    FASTNPROPERTY = '_fastn_property',
    FASTNCOMPONENT = '_fastn_component',
    DEFAULTBINDING = '_default_binding';

function isComponent(thing){
    return thing && typeof thing === OBJECT && FASTNCOMPONENT in thing;
}

function isBindingObject(thing){
    return thing && typeof thing === OBJECT && FASTNBINDING in thing;
}

function isBinding(thing){
    return typeof thing === FUNCTION && FASTNBINDING in thing;
}

function isProperty(thing){
    return typeof thing === FUNCTION && FASTNPROPERTY in thing;
}

function isDefaultBinding(thing){
    return typeof thing === FUNCTION && FASTNBINDING in thing && DEFAULTBINDING in thing;
}

module.exports = {
    component: isComponent,
    bindingObject: isBindingObject,
    binding: isBinding,
    defaultBinding: isDefaultBinding,
    property: isProperty
};
},{}],27:[function(require,module,exports){
var flatten = require('flatten');

module.exports = function(element){
    var lastClasses = [];

    return function(classes){

        if(!arguments.length){
            return lastClasses.join(' ');
        }

        function cleanClassName(result, className){
            if(typeof className === 'string' && className.match(/\s/)){
                className = className.split(' ');
            }

            if(Array.isArray(className)){
                return result.concat(className.reduce(cleanClassName, []));
            }

            if(className != null && className !== ''){
                result.push(String(className).trim());
            }

            return result;
        }

        var newClasses = cleanClassName([], classes),
            currentClasses = element.className ? element.className.split(' ') : [];

        lastClasses.map(function(className){
            if(!className){
                return;
            }

            var index = currentClasses.indexOf(className);

            if(~index){
                currentClasses.splice(index, 1);
            }
        });

        currentClasses = currentClasses.concat(newClasses);
        lastClasses = newClasses;

        element.className = currentClasses.join(' ');
    };
};
},{"flatten":29}],28:[function(require,module,exports){
(function (global){
var EventEmitter = require('events').EventEmitter;

function toArray(items){
    return Array.prototype.slice.call(items);
}

var deepRegex = /[|.]/i;

function matchDeep(path){
    return (path + '').match(deepRegex);
}

function isWildcardPath(path){
    var stringPath = (path + '');
    return ~stringPath.indexOf('*');
}

function getTargetKey(path){
    var stringPath = (path + '');
    return stringPath.split('|').shift();
}

var eventSystemVersion = 1,
    globalKey = '_entiEventState' + eventSystemVersion
    globalState = global[globalKey] = global[globalKey] || {
        instances: []
    };

var modifiedEnties = globalState.modifiedEnties = globalState.modifiedEnties || new Set(),
    trackedObjects = globalState.trackedObjects = globalState.trackedObjects || new WeakMap();

function leftAndRest(path){
    var stringPath = (path + '');

    // Special case when you want to filter on self (.)
    if(stringPath.slice(0,2) === '.|'){
        return ['.', stringPath.slice(2)];
    }

    var match = matchDeep(stringPath);
    if(match){
        return [stringPath.slice(0, match.index), stringPath.slice(match.index+1)];
    }
    return stringPath;
}

function isWildcardKey(key){
    return key.charAt(0) === '*';
}

function isFeralcardKey(key){
    return key === '**';
}

function addHandler(object, key, handler){
    var trackedKeys = trackedObjects.get(object);

    if(trackedKeys == null){
        trackedKeys = {};
        trackedObjects.set(object, trackedKeys);
    }

    var handlers = trackedKeys[key];

    if(!handlers){
        handlers = new Set();
        trackedKeys[key] = handlers;
    }

    handlers.add(handler);
}

function removeHandler(object, key, handler){
    var trackedKeys = trackedObjects.get(object);

    if(trackedKeys == null){
        return;
    }

    var handlers = trackedKeys[key];

    if(!handlers){
        return;
    }

    handlers.delete(handler);
}

function trackObjects(eventName, weakMap, handler, object, key, path){
    if(!object || typeof object !== 'object'){
        return;
    }

    var eventKey = key === '**' ? '*' : key,
        target = object[key],
        targetIsObject = target && typeof target === 'object';

    if(targetIsObject && weakMap.has(target)){
        return;
    }

    var handle = function(value, event, emitKey){
        if(eventKey !== '*' && typeof object[eventKey] === 'object' && object[eventKey] !== target){
            if(targetIsObject){
                weakMap.delete(target);
            }
            removeHandler(object, eventKey, handle);
            trackObjects(eventName, weakMap, handler, object, key, path);
            return;
        }

        if(eventKey === '*'){
            trackKeys(object, key, path);
        }

        if(!weakMap.has(object)){
            return;
        }

        if(key !== '**' || !path){
            handler(value, event, emitKey);
        }
    }

    function trackKeys(target, root, rest){
        var keys = Object.keys(target);
        for(var i = 0; i < keys.length; i++){
            if(isFeralcardKey(root)){
                trackObjects(eventName, weakMap, handler, target, keys[i], '**' + (rest ? '.' : '') + (rest || ''));
            }else{
                trackObjects(eventName, weakMap, handler, target, keys[i], rest);
            }
        }
    }

    addHandler(object, eventKey, handle);

    if(!targetIsObject){
        return;
    }

    // This would obviously be better implemented with a WeakSet,
    // But I'm trying to keep filesize down, and I don't really want another
    // polyfill when WeakMap works well enough for the task.
    weakMap.set(target, null);

    if(!path){
        return;
    }

    var rootAndRest = leftAndRest(path),
        root,
        rest;

    if(!Array.isArray(rootAndRest)){
        root = rootAndRest;
    }else{
        root = rootAndRest[0];
        rest = rootAndRest[1];

        // If the root is '.', watch for events on *
        if(root === '.'){
            root = '*';
        }
    }

    if(targetIsObject && isWildcardKey(root)){
        trackKeys(target, root, rest);
    }

    trackObjects(eventName, weakMap, handler, target, root, rest);
}

var trackedEvents = new WeakMap();
function createHandler(enti, trackedObjectPaths, trackedPaths, eventName){
    var oldModel = enti._model;
    return function(event, emitKey){
        trackedPaths.entis.forEach(function(enti){
            if(enti._emittedEvents[eventName] === emitKey){
                return;
            }

            if(enti._model !== oldModel){
                trackedPaths.entis.delete(enti);
                if(trackedPaths.entis.size === 0){
                    delete trackedObjectPaths[eventName];
                    if(!Object.keys(trackedObjectPaths).length){
                        trackedEvents.delete(oldModel);
                    }
                }
                return;
            }

            enti._emittedEvents[eventName] = emitKey;

            var targetKey = getTargetKey(eventName),
                value = isWildcardPath(targetKey) ? undefined : enti.get(targetKey);

            enti.emit(eventName, value, event);
        });
    };
}

function trackPath(enti, eventName){
    var object = enti._model,
        trackedObjectPaths = trackedEvents.get(object);

    if(!trackedObjectPaths){
        trackedObjectPaths = {};
        trackedEvents.set(object, trackedObjectPaths);
    }

    var trackedPaths = trackedObjectPaths[eventName];

    if(!trackedPaths){
        trackedPaths = {
            entis: new Set(),
            trackedObjects: new WeakMap()
        };
        trackedObjectPaths[eventName] = trackedPaths;
    }else if(trackedPaths.entis.has(enti)){
        return;
    }

    trackedPaths.entis.add(enti);

    var handler = createHandler(enti, trackedObjectPaths, trackedPaths, eventName);

    trackObjects(eventName, trackedPaths.trackedObjects, handler, {model:object}, 'model', eventName);
}

function trackPaths(enti){
    if(!enti._events || !enti._model){
        return;
    }

    for(var key in enti._events){
        trackPath(enti, key);
    }
    modifiedEnties.delete(enti);
}

function emitEvent(object, key, value, emitKey){

    modifiedEnties.forEach(trackPaths);

    var trackedKeys = trackedObjects.get(object);

    if(!trackedKeys){
        return;
    }

    var event = {
        value: value,
        key: key,
        object: object
    };

    function emitForKey(handler){
        handler(event, emitKey);
    }

    if(trackedKeys[key]){
        trackedKeys[key].forEach(emitForKey);
    }

    if(trackedKeys['*']){
        trackedKeys['*'].forEach(emitForKey);
    }
}

function emit(events){
    var emitKey = {};
    events.forEach(function(event){
        emitEvent(event[0], event[1], event[2], emitKey);
    });
}

function Enti(model){
    var detached = model === false;

    if(!model || (typeof model !== 'object' && typeof model !== 'function')){
        model = {};
    }

    this._emittedEvents = {};
    if(detached){
        this._model = {};
    }else{
        this.attach(model);
    }

    this.on('newListener', function(){
        modifiedEnties.add(this);
    });
}
Enti.get = function(model, key){
    if(!model || typeof model !== 'object'){
        return;
    }

    key = getTargetKey(key);

    if(key === '.'){
        return model;
    }


    var path = leftAndRest(key);
    if(Array.isArray(path)){
        return Enti.get(model[path[0]], path[1]);
    }

    return model[key];
};
Enti.set = function(model, key, value){
    if(!model || typeof model !== 'object'){
        return;
    }

    key = getTargetKey(key);

    var path = leftAndRest(key);
    if(Array.isArray(path)){
        return Enti.set(model[path[0]], path[1], value);
    }

    var original = model[key];

    if(typeof value !== 'object' && value === original){
        return;
    }

    var keysChanged = !(key in model);

    model[key] = value;

    var events = [[model, key, value]];

    if(keysChanged){
        if(Array.isArray(model)){
            events.push([model, 'length', model.length]);
        }
    }

    emit(events);
};
Enti.push = function(model, key, value){
    if(!model || typeof model !== 'object'){
        return;
    }

    var target;
    if(arguments.length < 3){
        value = key;
        key = '.';
        target = model;
    }else{
        var path = leftAndRest(key);
        if(Array.isArray(path)){
            return Enti.push(model[path[0]], path[1], value);
        }

        target = model[key];
    }

    if(!Array.isArray(target)){
        throw 'The target is not an array.';
    }

    target.push(value);

    var events = [
        [target, target.length-1, value],
        [target, 'length', target.length]
    ];

    emit(events);
};
Enti.insert = function(model, key, value, index){
    if(!model || typeof model !== 'object'){
        return;
    }


    var target;
    if(arguments.length < 4){
        index = value;
        value = key;
        key = '.';
        target = model;
    }else{
        var path = leftAndRest(key);
        if(Array.isArray(path)){
            return Enti.insert(model[path[0]], path[1], value, index);
        }

        target = model[key];
    }

    if(!Array.isArray(target)){
        throw 'The target is not an array.';
    }

    target.splice(index, 0, value);

    var events = [
        [target, index, value],
        [target, 'length', target.length]
    ];

    emit(events);
};
Enti.remove = function(model, key, subKey){
    if(!model || typeof model !== 'object'){
        return;
    }

    var path = leftAndRest(key);
    if(Array.isArray(path)){
        return Enti.remove(model[path[0]], path[1], subKey);
    }

    // Remove a key off of an object at 'key'
    if(subKey != null){
        Enti.remove(model[key], subKey);
        return;
    }

    if(key === '.'){
        throw '. (self) is not a valid key to remove';
    }

    var events = [];

    if(Array.isArray(model)){
        model.splice(key, 1);
        events.push([model, 'length', model.length]);
    }else{
        delete model[key];
        events.push([model, key]);
    }

    emit(events);
};
Enti.move = function(model, key, index){
    if(!model || typeof model !== 'object'){
        return;
    }

    var path = leftAndRest(key);
    if(Array.isArray(path)){
        return Enti.move(model[path[0]], path[1], index);
    }

    if(key === index){
        return;
    }

    if(!Array.isArray(model)){
        throw 'The model is not an array.';
    }

    var item = model[key];

    model.splice(key, 1);

    model.splice(index - (index > key ? 0 : 1), 0, item);

    emit([[model, index, item]]);
};
Enti.update = function(model, key, value){
    if(!model || typeof model !== 'object'){
        return;
    }

    var target,
        isArray = Array.isArray(value);

    if(arguments.length < 3){
        value = key;
        key = '.';
        target = model;
    }else{
        var path = leftAndRest(key);
        if(Array.isArray(path)){
            return Enti.update(model[path[0]], path[1], value);
        }

        target = model[key];

        if(target == null){
            model[key] = isArray ? [] : {};
        }
    }

    if(typeof value !== 'object'){
        throw 'The value is not an object.';
    }

    if(typeof target !== 'object'){
        throw 'The target is not an object.';
    }

    var events = [];

    function updateTarget(target, value){
        for(var key in value){
            if(target[key] && typeof target[key] === 'object'){
                updateTarget(target[key], value[key]);
                continue;
            }
            target[key] = value[key];
            events.push([target, key, value[key]]);
        }

        if(Array.isArray(target)){
            events.push([target, 'length', target.length]);
        }
    }

    updateTarget(target, value);

    emit(events);
};
Enti.prototype = Object.create(EventEmitter.prototype);
Enti.prototype._maxListeners = 100;
Enti.prototype.constructor = Enti;
Enti.prototype.attach = function(model){
    if(this._model !== model){
        this.detach();
    }

    modifiedEnties.add(this);
    this._attached = true;
    this._model = model;
    this.emit('attach', model);
};
Enti.prototype.detach = function(){
    modifiedEnties.delete(this);

    this._emittedEvents = {};
    this._model = {};
    this._attached = false;
    this.emit('detach');
};
Enti.prototype.destroy = function(){
    this.detach();
    this._events = null;
    this.emit('destroy');
};
Enti.prototype.get = function(key){
    return Enti.get(this._model, key);
};

Enti.prototype.set = function(key, value){
    return Enti.set(this._model, key, value);
};

Enti.prototype.push = function(key, value){
    return Enti.push.apply(null, [this._model].concat(toArray(arguments)));
};

Enti.prototype.insert = function(key, value, index){
    return Enti.insert.apply(null, [this._model].concat(toArray(arguments)));
};

Enti.prototype.remove = function(key, subKey){
    return Enti.remove.apply(null, [this._model].concat(toArray(arguments)));
};

Enti.prototype.move = function(key, index){
    return Enti.move.apply(null, [this._model].concat(toArray(arguments)));
};

Enti.prototype.update = function(key, index){
    return Enti.update.apply(null, [this._model].concat(toArray(arguments)));
};
Enti.prototype.isAttached = function(){
    return this._attached;
};
Enti.prototype.attachedCount = function(){
    return modifiedEnties.size;
};

Enti.isEnti = function(target){
    return target && !!~globalState.instances.indexOf(target.constructor);
};

globalState.instances.push(Enti);

module.exports = Enti;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"events":3}],29:[function(require,module,exports){
module.exports = function flatten(list, depth) {
  depth = (typeof depth == 'number') ? depth : Infinity;

  return _flatten(list, 1);

  function _flatten(list, d) {
    return list.reduce(function (acc, item) {
      if (Array.isArray(item) && d < depth) {
        return acc.concat(_flatten(item, d + 1));
      }
      else {
        return acc.concat(item);
      }
    }, []);
  }
};

},{}],30:[function(require,module,exports){
'use strict';
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function ToObject(val) {
	if (val == null) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function ownEnumerableKeys(obj) {
	var keys = Object.getOwnPropertyNames(obj);

	if (Object.getOwnPropertySymbols) {
		keys = keys.concat(Object.getOwnPropertySymbols(obj));
	}

	return keys.filter(function (key) {
		return propIsEnumerable.call(obj, key);
	});
}

module.exports = Object.assign || function (target, source) {
	var from;
	var keys;
	var to = ToObject(target);

	for (var s = 1; s < arguments.length; s++) {
		from = arguments[s];
		keys = ownEnumerableKeys(Object(from));

		for (var i = 0; i < keys.length; i++) {
			to[keys[i]] = from[keys[i]];
		}
	}

	return to;
};

},{}],31:[function(require,module,exports){
module.exports = function isSame(a, b){
    if(a === b){
        return true;
    }

    if(
        typeof a !== typeof b ||
        typeof a === 'object' &&
        !(a instanceof Date && b instanceof Date)
    ){
        return false;
    }

    return String(a) === String(b);
};
},{}],32:[function(require,module,exports){
var naturalSelection = require('natural-selection');

module.exports = function(element, value){
    var canSet = naturalSelection(element) && element === document.activeElement;

    if (canSet) {
        var start = element.selectionStart,
            end = element.selectionEnd;

        element.value = value;
        element.setSelectionRange(start, end);
    } else {
        element.value = value;
    }
};

},{"natural-selection":33}],33:[function(require,module,exports){
var supportedTypes = ['text', 'search', 'tel', 'url', 'password'];

module.exports = function(element){
    return !!(element.setSelectionRange && ~supportedTypes.indexOf(element.type));
};

},{}],34:[function(require,module,exports){
module.exports = Object.setPrototypeOf || {__proto__:[]} instanceof Array ? setProtoOf : mixinProperties;

function setProtoOf(obj, proto) {
	obj.__proto__ = proto;
}

function mixinProperties(obj, proto) {
	for (var prop in proto) {
		obj[prop] = proto[prop];
	}
}

},{}],35:[function(require,module,exports){
var clone = require('clone'),
    deepEqual = require('deep-equal');

function keysAreDifferent(keys1, keys2){
    if(keys1 === keys2){
        return;
    }
    if(!keys1 || !keys2 || keys1.length !== keys2.length){
        return true;
    }
    for(var i = 0; i < keys1.length; i++){
        if(!~keys2.indexOf(keys1[i])){
            return true;
        }
    }
}

function getKeys(value){
    if(!value || typeof value !== 'object'){
        return;
    }

    return Object.keys(value);
}

function WhatChanged(value, changesToTrack){
    this._changesToTrack = {};

    if(changesToTrack == null){
        changesToTrack = 'value type keys structure reference';
    }

    if(typeof changesToTrack !== 'string'){
        throw 'changesToTrack must be of type string';
    }

    changesToTrack = changesToTrack.split(' ');

    for (var i = 0; i < changesToTrack.length; i++) {
        this._changesToTrack[changesToTrack[i]] = true;
    };

    this.update(value);
}
WhatChanged.prototype.update = function(value){
    var result = {},
        changesToTrack = this._changesToTrack,
        newKeys = getKeys(value);

    if('value' in changesToTrack && value+'' !== this._lastReference+''){
        result.value = true;
    }
    if(
        'type' in changesToTrack && typeof value !== typeof this._lastValue ||
        (value === null || this._lastValue === null) && this.value !== this._lastValue // typeof null === 'object'
    ){
        result.type = true;
    }
    if('keys' in changesToTrack && keysAreDifferent(this._lastKeys, getKeys(value))){
        result.keys = true;
    }

    if(value !== null && typeof value === 'object'){
        var lastValue = this._lastValue;

        if('shallowStructure' in changesToTrack && (!lastValue || typeof lastValue !== 'object' || Object.keys(value).some(function(key, index){
            return value[key] !== lastValue[key];
        }))){
            result.shallowStructure = true;
        }
        if('structure' in changesToTrack && !deepEqual(value, lastValue)){
            result.structure = true;
        }
        if('reference' in changesToTrack && value !== this._lastReference){
            result.reference = true;
        }
    }

    this._lastValue = 'structure' in changesToTrack ? clone(value) : 'shallowStructure' in changesToTrack ? clone(value, true, 1): value;
    this._lastReference = value;
    this._lastKeys = newKeys;

    return result;
};

module.exports = WhatChanged;
},{"clone":36,"deep-equal":37}],36:[function(require,module,exports){
(function (Buffer){
var clone = (function() {
'use strict';

/**
 * Clones (copies) an Object using deep copying.
 *
 * This function supports circular references by default, but if you are certain
 * there are no circular references in your object, you can save some CPU time
 * by calling clone(obj, false).
 *
 * Caution: if `circular` is false and `parent` contains circular references,
 * your program may enter an infinite loop and crash.
 *
 * @param `parent` - the object to be cloned
 * @param `circular` - set to true if the object to be cloned may contain
 *    circular references. (optional - true by default)
 * @param `depth` - set to a number if the object is only to be cloned to
 *    a particular depth. (optional - defaults to Infinity)
 * @param `prototype` - sets the prototype to be used when cloning an object.
 *    (optional - defaults to parent prototype).
*/
function clone(parent, circular, depth, prototype) {
  var filter;
  if (typeof circular === 'object') {
    depth = circular.depth;
    prototype = circular.prototype;
    filter = circular.filter;
    circular = circular.circular
  }
  // maintain two arrays for circular references, where corresponding parents
  // and children have the same index
  var allParents = [];
  var allChildren = [];

  var useBuffer = typeof Buffer != 'undefined';

  if (typeof circular == 'undefined')
    circular = true;

  if (typeof depth == 'undefined')
    depth = Infinity;

  // recurse this function so we don't reset allParents and allChildren
  function _clone(parent, depth) {
    // cloning null always returns null
    if (parent === null)
      return null;

    if (depth == 0)
      return parent;

    var child;
    var proto;
    if (typeof parent != 'object') {
      return parent;
    }

    if (clone.__isArray(parent)) {
      child = [];
    } else if (clone.__isRegExp(parent)) {
      child = new RegExp(parent.source, __getRegExpFlags(parent));
      if (parent.lastIndex) child.lastIndex = parent.lastIndex;
    } else if (clone.__isDate(parent)) {
      child = new Date(parent.getTime());
    } else if (useBuffer && Buffer.isBuffer(parent)) {
      child = new Buffer(parent.length);
      parent.copy(child);
      return child;
    } else {
      if (typeof prototype == 'undefined') {
        proto = Object.getPrototypeOf(parent);
        child = Object.create(proto);
      }
      else {
        child = Object.create(prototype);
        proto = prototype;
      }
    }

    if (circular) {
      var index = allParents.indexOf(parent);

      if (index != -1) {
        return allChildren[index];
      }
      allParents.push(parent);
      allChildren.push(child);
    }

    for (var i in parent) {
      var attrs;
      if (proto) {
        attrs = Object.getOwnPropertyDescriptor(proto, i);
      }

      if (attrs && attrs.set == null) {
        continue;
      }
      child[i] = _clone(parent[i], depth - 1);
    }

    return child;
  }

  return _clone(parent, depth);
}

/**
 * Simple flat clone using prototype, accepts only objects, usefull for property
 * override on FLAT configuration object (no nested props).
 *
 * USE WITH CAUTION! This may not behave as you wish if you do not know how this
 * works.
 */
clone.clonePrototype = function clonePrototype(parent) {
  if (parent === null)
    return null;

  var c = function () {};
  c.prototype = parent;
  return new c();
};

// private utility functions

function __objToStr(o) {
  return Object.prototype.toString.call(o);
};
clone.__objToStr = __objToStr;

function __isDate(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Date]';
};
clone.__isDate = __isDate;

function __isArray(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Array]';
};
clone.__isArray = __isArray;

function __isRegExp(o) {
  return typeof o === 'object' && __objToStr(o) === '[object RegExp]';
};
clone.__isRegExp = __isRegExp;

function __getRegExpFlags(re) {
  var flags = '';
  if (re.global) flags += 'g';
  if (re.ignoreCase) flags += 'i';
  if (re.multiline) flags += 'm';
  return flags;
};
clone.__getRegExpFlags = __getRegExpFlags;

return clone;
})();

if (typeof module === 'object' && module.exports) {
  module.exports = clone;
}

}).call(this,require("buffer").Buffer)

},{"buffer":2}],37:[function(require,module,exports){
var pSlice = Array.prototype.slice;
var objectKeys = require('./lib/keys.js');
var isArguments = require('./lib/is_arguments.js');

var deepEqual = module.exports = function (actual, expected, opts) {
  if (!opts) opts = {};
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (typeof actual != 'object' && typeof expected != 'object') {
    return opts.strict ? actual === expected : actual == expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected, opts);
  }
}

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isBuffer (x) {
  if (!x || typeof x !== 'object' || typeof x.length !== 'number') return false;
  if (typeof x.copy !== 'function' || typeof x.slice !== 'function') {
    return false;
  }
  if (x.length > 0 && typeof x[0] !== 'number') return false;
  return true;
}

function objEquiv(a, b, opts) {
  var i, key;
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return deepEqual(a, b, opts);
  }
  if (isBuffer(a)) {
    if (!isBuffer(b)) {
      return false;
    }
    if (a.length !== b.length) return false;
    for (i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  try {
    var ka = objectKeys(a),
        kb = objectKeys(b);
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!deepEqual(a[key], b[key], opts)) return false;
  }
  return typeof a === typeof b;
}

},{"./lib/is_arguments.js":38,"./lib/keys.js":39}],38:[function(require,module,exports){
var supportsArgumentsClass = (function(){
  return Object.prototype.toString.call(arguments)
})() == '[object Arguments]';

exports = module.exports = supportsArgumentsClass ? supported : unsupported;

exports.supported = supported;
function supported(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
};

exports.unsupported = unsupported;
function unsupported(object){
  return object &&
    typeof object == 'object' &&
    typeof object.length == 'number' &&
    Object.prototype.hasOwnProperty.call(object, 'callee') &&
    !Object.prototype.propertyIsEnumerable.call(object, 'callee') ||
    false;
};

},{}],39:[function(require,module,exports){
exports = module.exports = typeof Object.keys === 'function'
  ? Object.keys : shim;

exports.shim = shim;
function shim (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}

},{}],40:[function(require,module,exports){
var Enti = require('enti'),
    WhatChanged = require('what-changed'),
    same = require('same-value'),
    firmer = require('./firmer'),
    createBinding = require('./binding'),
    functionEmitter = require('./functionEmitter'),
    setPrototypeOf = require('setprototypeof'),
    is = require('./is');

var propertyProto = Object.create(functionEmitter);

propertyProto._fastn_property = true;
propertyProto._firm = 1;

function propertyTemplate(value){
    if(!arguments.length){
        return this.binding && this.binding() || this.property._value;
    }

    if(!this.destroyed){
        if(this.binding){
            this.binding(value);
            return this.property;
        }

        this.valueUpdate(value);
    }

    return this.property;
}

function changeChecker(current, changes){
    if(changes){
        var changes = new WhatChanged(current, changes);

        return function(value){
            return Object.keys(changes.update(value)).length > 0;
        };
    }else{
        var lastValue = current;
        return function(newValue){
            if(!same(lastValue, newValue)){
                lastValue = newValue;
                return true;
            }
        };
    }
}


function propertyBinding(newBinding){
    if(!arguments.length){
        return this.binding;
    }

    if(!is.binding(newBinding)){
        newBinding = createBinding(newBinding);
    }

    if(newBinding === this.binding){
        return this.property;
    }

    if(this.binding){
        this.binding.removeListener('change', this.valueUpdate);
    }

    this.binding = newBinding;

    if(this.model){
        this.property.attach(this.model, this.property._firm);
    }

    this.binding.on('change', this.valueUpdate);
    this.valueUpdate(this.binding());

    return this.property;
};

function attachProperty(object, firm){
    if(firmer(this.property, firm)){
        return this.property;
    }

    this.property._firm = firm;

    if(!(object instanceof Object)){
        object = {};
    }

    if(this.binding){
        this.model = object;
        this.binding.attach(object, 1);
    }

    if(this.property._events && 'attach' in this.property._events){
        this.property.emit('attach', object, 1);
    }

    return this.property;
};

function detachProperty(firm){
    if(firmer(this.property, firm)){
        return this.property;
    }

    if(this.binding){
        this.binding.removeListener('change', this.valueUpdate);
        this.binding.detach(1);
        this.model = null;
    }

    if(this.property._events && 'detach' in this.property._events){
        this.property.emit('detach', 1);
    }

    return this.property;
};

function updateProperty(){
    if(!this.destroyed){

        if(this.property._update){
            this.property._update(this.property._value, this.property);
        }

        this.property.emit('update', this.property._value);
    }
    return this.property;
};

function propertyUpdater(fn){
    if(!arguments.length){
        return this.property._update;
    }
    this.property._update = fn;
    return this.property;
};

function destroyProperty(){
    if(!this.destroyed){
        this.destroyed = true;

        this.property
            .removeAllListeners('change')
            .removeAllListeners('update')
            .removeAllListeners('attach');

        this.property.emit('destroy');
        this.property.detach();
        if(this.binding){
            this.binding.destroy(true);
        }
    }
    return this.property;
};

function propertyDestroyed(){
    return this.destroyed;
};

function addPropertyTo(component, key){
    component.setProperty(key, this.property);

    return this.property;
};

function createProperty(currentValue, changes, updater){
    if(typeof changes === 'function'){
        updater = changes;
        changes = null;
    }

    var propertyScope =
        property = propertyTemplate.bind(propertyScope)
        propertyScope = {
        hasChanged: changeChecker(currentValue, changes),
        valueUpdate: function(value){
            property._value = value;
            if(!propertyScope.hasChanged(value)){
                return;
            }
            property.emit('change', property._value);
            property.update();
        }
    };

    var property = propertyScope.property = propertyTemplate.bind(propertyScope);

    property._value = currentValue;
    property._update = updater;

    setPrototypeOf(property, propertyProto);

    property.binding = propertyBinding.bind(propertyScope);
    property.attach = attachProperty.bind(propertyScope);
    property.detach = detachProperty.bind(propertyScope);
    property.update = updateProperty.bind(propertyScope);
    property.updater = propertyUpdater.bind(propertyScope);
    property.destroy = destroyProperty.bind(propertyScope);
    property.destroyed = propertyDestroyed.bind(propertyScope);
    property.addTo = addPropertyTo.bind(propertyScope);

    return property;
};

module.exports = createProperty;
},{"./binding":19,"./firmer":22,"./functionEmitter":23,"./is":26,"enti":28,"same-value":31,"setprototypeof":34,"what-changed":35}],41:[function(require,module,exports){
var todo = [],
    todoKeys = [],
    scheduled,
    updates = 0;

function run(){
    var startTime = Date.now();

    while(todo.length && Date.now() - startTime < 16){
        todoKeys.shift();
        todo.shift()();
    }

    if(todo.length){
        requestAnimationFrame(run);
    }else{
        scheduled = false;
    }
}

function schedule(key, fn){
    if(~todoKeys.indexOf(key)){
        return;
    }

    todo.push(fn);
    todoKeys.push(key);

    if(!scheduled){
        scheduled = true;
        requestAnimationFrame(run);
    }
}

module.exports = schedule;
},{}],42:[function(require,module,exports){
function updateText(){
    if(!this.element){
        return;
    }

    var value = this.text();

    this.element.textContent = (value == null ? '' : value);
}

function autoRender(content){
    this.element = document.createTextNode(content);
}

function autoText(text, fastn, content) {
    text.render = autoRender.bind(text, content);

    return text;
}

function render(){
    this.element = this.createTextNode(this.text());
    this.emit('render');
};

function textComponent(fastn, component, type, settings, children){
    if(settings.auto){
        delete settings.auto;
        if(!fastn.isBinding(children[0])){
            return autoText(component, fastn, children[0]);
        }
        settings.text = children.pop();
    }

    component.createTextNode = textComponent.createTextNode;
    component.render = render.bind(component);

    component.setProperty('text', fastn.property('', updateText.bind(component)));

    return component;
}

textComponent.createTextNode = function(text){
    return document.createTextNode(text);
};

module.exports = textComponent;
},{}],43:[function(require,module,exports){

/**
 * Check if the given `year` is a leap year
 *
 * @api public
 * @param {Date|Number} year
 * @return {Boolean}
 */

module.exports = function (year) {
  year = (year instanceof Date)
      ? year.getFullYear()
      : year;

  return !(new Date(year, 1, 29).getMonth() - 1);
};

},{}],44:[function(require,module,exports){
var parseDate = require('date-parse'),
    dehumanizeDate = require('dehumanize-date'),
    auzzieDate = /(.*)[\/,\s-](.*)[\/,\s-](.{4})/;

module.exports = function(value){
    var date;

    if(typeof value === 'string'){
        var match = value.match(auzzieDate);
        if(match){
            date = new Date([match[3], match[2], match[1]].join('/'));
            if(!isNaN(date)){
                return date;
            }
        }
    }

    return parseDate(dehumanizeDate(value) || value);
};
},{"date-parse":10,"dehumanize-date":12}]},{},[7])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92Ni4zLjEvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiLi4vLi4vLm52bS92ZXJzaW9ucy9ub2RlL3Y2LjMuMS9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIi4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92Ni4zLjEvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL2luZGV4LmpzIiwiLi4vLi4vLm52bS92ZXJzaW9ucy9ub2RlL3Y2LjMuMS9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwiLi4vLi4vLm52bS92ZXJzaW9ucy9ub2RlL3Y2LjMuMS9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwiLi4vLi4vLm52bS92ZXJzaW9ucy9ub2RlL3Y2LjMuMS9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9pc2FycmF5L2luZGV4LmpzIiwiZGF0ZXBpY2tlckNvbXBvbmVudC5qcyIsImV4YW1wbGUvaW5kZXguanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jcmVsL2NyZWwuanMiLCJub2RlX21vZHVsZXMvZGF0ZS1wYXJzZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9kZWZhdWx0Y3NzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2RlaHVtYW5pemUtZGF0ZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9kb2MtanMvZG9jLmpzIiwibm9kZV9tb2R1bGVzL2RvYy1qcy9mbHVlbnQuanMiLCJub2RlX21vZHVsZXMvZG9jLWpzL2dldFRhcmdldC5qcyIsIm5vZGVfbW9kdWxlcy9kb2MtanMvZ2V0VGFyZ2V0cy5qcyIsIm5vZGVfbW9kdWxlcy9kb2MtanMvaXNMaXN0LmpzIiwibm9kZV9tb2R1bGVzL2Zhc3RuL2Jhc2VDb21wb25lbnQuanMiLCJub2RlX21vZHVsZXMvZmFzdG4vYmluZGluZy5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9jb250YWluZXJDb21wb25lbnQuanMiLCJub2RlX21vZHVsZXMvZmFzdG4vZmFuY3lQcm9wcy5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9maXJtZXIuanMiLCJub2RlX21vZHVsZXMvZmFzdG4vZnVuY3Rpb25FbWl0dGVyLmpzIiwibm9kZV9tb2R1bGVzL2Zhc3RuL2dlbmVyaWNDb21wb25lbnQuanMiLCJub2RlX21vZHVsZXMvZmFzdG4vaW5kZXguanMiLCJub2RlX21vZHVsZXMvZmFzdG4vaXMuanMiLCJub2RlX21vZHVsZXMvZmFzdG4vbm9kZV9tb2R1bGVzL2NsYXNzaXN0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Zhc3RuL25vZGVfbW9kdWxlcy9lbnRpL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Zhc3RuL25vZGVfbW9kdWxlcy9mbGF0dGVuL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Zhc3RuL25vZGVfbW9kdWxlcy9vYmplY3QtYXNzaWduL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Zhc3RuL25vZGVfbW9kdWxlcy9zYW1lLXZhbHVlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Zhc3RuL25vZGVfbW9kdWxlcy9zZXRpZnkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZmFzdG4vbm9kZV9tb2R1bGVzL3NldGlmeS9ub2RlX21vZHVsZXMvbmF0dXJhbC1zZWxlY3Rpb24vaW5kZXguanMiLCJub2RlX21vZHVsZXMvZmFzdG4vbm9kZV9tb2R1bGVzL3NldHByb3RvdHlwZW9mL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Zhc3RuL25vZGVfbW9kdWxlcy93aGF0LWNoYW5nZWQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZmFzdG4vbm9kZV9tb2R1bGVzL3doYXQtY2hhbmdlZC9ub2RlX21vZHVsZXMvY2xvbmUvY2xvbmUuanMiLCJub2RlX21vZHVsZXMvZmFzdG4vbm9kZV9tb2R1bGVzL3doYXQtY2hhbmdlZC9ub2RlX21vZHVsZXMvZGVlcC1lcXVhbC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9ub2RlX21vZHVsZXMvd2hhdC1jaGFuZ2VkL25vZGVfbW9kdWxlcy9kZWVwLWVxdWFsL2xpYi9pc19hcmd1bWVudHMuanMiLCJub2RlX21vZHVsZXMvZmFzdG4vbm9kZV9tb2R1bGVzL3doYXQtY2hhbmdlZC9ub2RlX21vZHVsZXMvZGVlcC1lcXVhbC9saWIva2V5cy5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9wcm9wZXJ0eS5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9zY2hlZHVsZS5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi90ZXh0Q29tcG9uZW50LmpzIiwibm9kZV9tb2R1bGVzL2lzLWxlYXAteWVhci9pbmRleC5qcyIsInBhcnNlRGF0ZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzdHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2pyREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6a0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBOztBQ0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDek9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2hsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDaEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL01BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0J1xuXG5leHBvcnRzLnRvQnl0ZUFycmF5ID0gdG9CeXRlQXJyYXlcbmV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IGZyb21CeXRlQXJyYXlcblxudmFyIGxvb2t1cCA9IFtdXG52YXIgcmV2TG9va3VwID0gW11cbnZhciBBcnIgPSB0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcgPyBVaW50OEFycmF5IDogQXJyYXlcblxuZnVuY3Rpb24gaW5pdCAoKSB7XG4gIHZhciBjb2RlID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjb2RlLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgbG9va3VwW2ldID0gY29kZVtpXVxuICAgIHJldkxvb2t1cFtjb2RlLmNoYXJDb2RlQXQoaSldID0gaVxuICB9XG5cbiAgcmV2TG9va3VwWyctJy5jaGFyQ29kZUF0KDApXSA9IDYyXG4gIHJldkxvb2t1cFsnXycuY2hhckNvZGVBdCgwKV0gPSA2M1xufVxuXG5pbml0KClcblxuZnVuY3Rpb24gdG9CeXRlQXJyYXkgKGI2NCkge1xuICB2YXIgaSwgaiwgbCwgdG1wLCBwbGFjZUhvbGRlcnMsIGFyclxuICB2YXIgbGVuID0gYjY0Lmxlbmd0aFxuXG4gIGlmIChsZW4gJSA0ID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG4gIH1cblxuICAvLyB0aGUgbnVtYmVyIG9mIGVxdWFsIHNpZ25zIChwbGFjZSBob2xkZXJzKVxuICAvLyBpZiB0aGVyZSBhcmUgdHdvIHBsYWNlaG9sZGVycywgdGhhbiB0aGUgdHdvIGNoYXJhY3RlcnMgYmVmb3JlIGl0XG4gIC8vIHJlcHJlc2VudCBvbmUgYnl0ZVxuICAvLyBpZiB0aGVyZSBpcyBvbmx5IG9uZSwgdGhlbiB0aGUgdGhyZWUgY2hhcmFjdGVycyBiZWZvcmUgaXQgcmVwcmVzZW50IDIgYnl0ZXNcbiAgLy8gdGhpcyBpcyBqdXN0IGEgY2hlYXAgaGFjayB0byBub3QgZG8gaW5kZXhPZiB0d2ljZVxuICBwbGFjZUhvbGRlcnMgPSBiNjRbbGVuIC0gMl0gPT09ICc9JyA/IDIgOiBiNjRbbGVuIC0gMV0gPT09ICc9JyA/IDEgOiAwXG5cbiAgLy8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG4gIGFyciA9IG5ldyBBcnIobGVuICogMyAvIDQgLSBwbGFjZUhvbGRlcnMpXG5cbiAgLy8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuICBsID0gcGxhY2VIb2xkZXJzID4gMCA/IGxlbiAtIDQgOiBsZW5cblxuICB2YXIgTCA9IDBcblxuICBmb3IgKGkgPSAwLCBqID0gMDsgaSA8IGw7IGkgKz0gNCwgaiArPSAzKSB7XG4gICAgdG1wID0gKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMTgpIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldIDw8IDEyKSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDIpXSA8PCA2KSB8IHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMyldXG4gICAgYXJyW0wrK10gPSAodG1wID4+IDE2KSAmIDB4RkZcbiAgICBhcnJbTCsrXSA9ICh0bXAgPj4gOCkgJiAweEZGXG4gICAgYXJyW0wrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICBpZiAocGxhY2VIb2xkZXJzID09PSAyKSB7XG4gICAgdG1wID0gKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMikgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPj4gNClcbiAgICBhcnJbTCsrXSA9IHRtcCAmIDB4RkZcbiAgfSBlbHNlIGlmIChwbGFjZUhvbGRlcnMgPT09IDEpIHtcbiAgICB0bXAgPSAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAxMCkgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPDwgNCkgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAyKV0gPj4gMilcbiAgICBhcnJbTCsrXSA9ICh0bXAgPj4gOCkgJiAweEZGXG4gICAgYXJyW0wrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICByZXR1cm4gYXJyXG59XG5cbmZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG4gIHJldHVybiBsb29rdXBbbnVtID4+IDE4ICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDEyICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDYgJiAweDNGXSArIGxvb2t1cFtudW0gJiAweDNGXVxufVxuXG5mdW5jdGlvbiBlbmNvZGVDaHVuayAodWludDgsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHRtcFxuICB2YXIgb3V0cHV0ID0gW11cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpICs9IDMpIHtcbiAgICB0bXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pXG4gICAgb3V0cHV0LnB1c2godHJpcGxldFRvQmFzZTY0KHRtcCkpXG4gIH1cbiAgcmV0dXJuIG91dHB1dC5qb2luKCcnKVxufVxuXG5mdW5jdGlvbiBmcm9tQnl0ZUFycmF5ICh1aW50OCkge1xuICB2YXIgdG1wXG4gIHZhciBsZW4gPSB1aW50OC5sZW5ndGhcbiAgdmFyIGV4dHJhQnl0ZXMgPSBsZW4gJSAzIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG4gIHZhciBvdXRwdXQgPSAnJ1xuICB2YXIgcGFydHMgPSBbXVxuICB2YXIgbWF4Q2h1bmtMZW5ndGggPSAxNjM4MyAvLyBtdXN0IGJlIG11bHRpcGxlIG9mIDNcblxuICAvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG4gIGZvciAodmFyIGkgPSAwLCBsZW4yID0gbGVuIC0gZXh0cmFCeXRlczsgaSA8IGxlbjI7IGkgKz0gbWF4Q2h1bmtMZW5ndGgpIHtcbiAgICBwYXJ0cy5wdXNoKGVuY29kZUNodW5rKHVpbnQ4LCBpLCAoaSArIG1heENodW5rTGVuZ3RoKSA+IGxlbjIgPyBsZW4yIDogKGkgKyBtYXhDaHVua0xlbmd0aCkpKVxuICB9XG5cbiAgLy8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuICBpZiAoZXh0cmFCeXRlcyA9PT0gMSkge1xuICAgIHRtcCA9IHVpbnQ4W2xlbiAtIDFdXG4gICAgb3V0cHV0ICs9IGxvb2t1cFt0bXAgPj4gMl1cbiAgICBvdXRwdXQgKz0gbG9va3VwWyh0bXAgPDwgNCkgJiAweDNGXVxuICAgIG91dHB1dCArPSAnPT0nXG4gIH0gZWxzZSBpZiAoZXh0cmFCeXRlcyA9PT0gMikge1xuICAgIHRtcCA9ICh1aW50OFtsZW4gLSAyXSA8PCA4KSArICh1aW50OFtsZW4gLSAxXSlcbiAgICBvdXRwdXQgKz0gbG9va3VwW3RtcCA+PiAxMF1cbiAgICBvdXRwdXQgKz0gbG9va3VwWyh0bXAgPj4gNCkgJiAweDNGXVxuICAgIG91dHB1dCArPSBsb29rdXBbKHRtcCA8PCAyKSAmIDB4M0ZdXG4gICAgb3V0cHV0ICs9ICc9J1xuICB9XG5cbiAgcGFydHMucHVzaChvdXRwdXQpXG5cbiAgcmV0dXJuIHBhcnRzLmpvaW4oJycpXG59XG4iLCIvKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1wcm90byAqL1xuXG4ndXNlIHN0cmljdCdcblxudmFyIGJhc2U2NCA9IHJlcXVpcmUoJ2Jhc2U2NC1qcycpXG52YXIgaWVlZTc1NCA9IHJlcXVpcmUoJ2llZWU3NTQnKVxudmFyIGlzQXJyYXkgPSByZXF1aXJlKCdpc2FycmF5JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IFNsb3dCdWZmZXJcbmV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVMgPSA1MFxuXG4vKipcbiAqIElmIGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGA6XG4gKiAgID09PSB0cnVlICAgIFVzZSBVaW50OEFycmF5IGltcGxlbWVudGF0aW9uIChmYXN0ZXN0KVxuICogICA9PT0gZmFsc2UgICBVc2UgT2JqZWN0IGltcGxlbWVudGF0aW9uIChtb3N0IGNvbXBhdGlibGUsIGV2ZW4gSUU2KVxuICpcbiAqIEJyb3dzZXJzIHRoYXQgc3VwcG9ydCB0eXBlZCBhcnJheXMgYXJlIElFIDEwKywgRmlyZWZveCA0KywgQ2hyb21lIDcrLCBTYWZhcmkgNS4xKyxcbiAqIE9wZXJhIDExLjYrLCBpT1MgNC4yKy5cbiAqXG4gKiBEdWUgdG8gdmFyaW91cyBicm93c2VyIGJ1Z3MsIHNvbWV0aW1lcyB0aGUgT2JqZWN0IGltcGxlbWVudGF0aW9uIHdpbGwgYmUgdXNlZCBldmVuXG4gKiB3aGVuIHRoZSBicm93c2VyIHN1cHBvcnRzIHR5cGVkIGFycmF5cy5cbiAqXG4gKiBOb3RlOlxuICpcbiAqICAgLSBGaXJlZm94IDQtMjkgbGFja3Mgc3VwcG9ydCBmb3IgYWRkaW5nIG5ldyBwcm9wZXJ0aWVzIHRvIGBVaW50OEFycmF5YCBpbnN0YW5jZXMsXG4gKiAgICAgU2VlOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02OTU0MzguXG4gKlxuICogICAtIENocm9tZSA5LTEwIGlzIG1pc3NpbmcgdGhlIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24uXG4gKlxuICogICAtIElFMTAgaGFzIGEgYnJva2VuIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24gd2hpY2ggcmV0dXJucyBhcnJheXMgb2ZcbiAqICAgICBpbmNvcnJlY3QgbGVuZ3RoIGluIHNvbWUgc2l0dWF0aW9ucy5cblxuICogV2UgZGV0ZWN0IHRoZXNlIGJ1Z2d5IGJyb3dzZXJzIGFuZCBzZXQgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYCB0byBgZmFsc2VgIHNvIHRoZXlcbiAqIGdldCB0aGUgT2JqZWN0IGltcGxlbWVudGF0aW9uLCB3aGljaCBpcyBzbG93ZXIgYnV0IGJlaGF2ZXMgY29ycmVjdGx5LlxuICovXG5CdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCA9IGdsb2JhbC5UWVBFRF9BUlJBWV9TVVBQT1JUICE9PSB1bmRlZmluZWRcbiAgPyBnbG9iYWwuVFlQRURfQVJSQVlfU1VQUE9SVFxuICA6IHR5cGVkQXJyYXlTdXBwb3J0KClcblxuLypcbiAqIEV4cG9ydCBrTWF4TGVuZ3RoIGFmdGVyIHR5cGVkIGFycmF5IHN1cHBvcnQgaXMgZGV0ZXJtaW5lZC5cbiAqL1xuZXhwb3J0cy5rTWF4TGVuZ3RoID0ga01heExlbmd0aCgpXG5cbmZ1bmN0aW9uIHR5cGVkQXJyYXlTdXBwb3J0ICgpIHtcbiAgdHJ5IHtcbiAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoMSlcbiAgICBhcnIuX19wcm90b19fID0ge19fcHJvdG9fXzogVWludDhBcnJheS5wcm90b3R5cGUsIGZvbzogZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfX1cbiAgICByZXR1cm4gYXJyLmZvbygpID09PSA0MiAmJiAvLyB0eXBlZCBhcnJheSBpbnN0YW5jZXMgY2FuIGJlIGF1Z21lbnRlZFxuICAgICAgICB0eXBlb2YgYXJyLnN1YmFycmF5ID09PSAnZnVuY3Rpb24nICYmIC8vIGNocm9tZSA5LTEwIGxhY2sgYHN1YmFycmF5YFxuICAgICAgICBhcnIuc3ViYXJyYXkoMSwgMSkuYnl0ZUxlbmd0aCA9PT0gMCAvLyBpZTEwIGhhcyBicm9rZW4gYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuZnVuY3Rpb24ga01heExlbmd0aCAoKSB7XG4gIHJldHVybiBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVFxuICAgID8gMHg3ZmZmZmZmZlxuICAgIDogMHgzZmZmZmZmZlxufVxuXG5mdW5jdGlvbiBjcmVhdGVCdWZmZXIgKHRoYXQsIGxlbmd0aCkge1xuICBpZiAoa01heExlbmd0aCgpIDwgbGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0ludmFsaWQgdHlwZWQgYXJyYXkgbGVuZ3RoJylcbiAgfVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICB0aGF0ID0gbmV3IFVpbnQ4QXJyYXkobGVuZ3RoKVxuICAgIHRoYXQuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gYW4gb2JqZWN0IGluc3RhbmNlIG9mIHRoZSBCdWZmZXIgY2xhc3NcbiAgICBpZiAodGhhdCA9PT0gbnVsbCkge1xuICAgICAgdGhhdCA9IG5ldyBCdWZmZXIobGVuZ3RoKVxuICAgIH1cbiAgICB0aGF0Lmxlbmd0aCA9IGxlbmd0aFxuICB9XG5cbiAgcmV0dXJuIHRoYXRcbn1cblxuLyoqXG4gKiBUaGUgQnVmZmVyIGNvbnN0cnVjdG9yIHJldHVybnMgaW5zdGFuY2VzIG9mIGBVaW50OEFycmF5YCB0aGF0IGhhdmUgdGhlaXJcbiAqIHByb3RvdHlwZSBjaGFuZ2VkIHRvIGBCdWZmZXIucHJvdG90eXBlYC4gRnVydGhlcm1vcmUsIGBCdWZmZXJgIGlzIGEgc3ViY2xhc3Mgb2ZcbiAqIGBVaW50OEFycmF5YCwgc28gdGhlIHJldHVybmVkIGluc3RhbmNlcyB3aWxsIGhhdmUgYWxsIHRoZSBub2RlIGBCdWZmZXJgIG1ldGhvZHNcbiAqIGFuZCB0aGUgYFVpbnQ4QXJyYXlgIG1ldGhvZHMuIFNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0XG4gKiByZXR1cm5zIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIFRoZSBgVWludDhBcnJheWAgcHJvdG90eXBlIHJlbWFpbnMgdW5tb2RpZmllZC5cbiAqL1xuXG5mdW5jdGlvbiBCdWZmZXIgKGFyZywgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKSB7XG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgJiYgISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSkge1xuICAgIHJldHVybiBuZXcgQnVmZmVyKGFyZywgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxuICB9XG5cbiAgLy8gQ29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnbnVtYmVyJykge1xuICAgIGlmICh0eXBlb2YgZW5jb2RpbmdPck9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ0lmIGVuY29kaW5nIGlzIHNwZWNpZmllZCB0aGVuIHRoZSBmaXJzdCBhcmd1bWVudCBtdXN0IGJlIGEgc3RyaW5nJ1xuICAgICAgKVxuICAgIH1cbiAgICByZXR1cm4gYWxsb2NVbnNhZmUodGhpcywgYXJnKVxuICB9XG4gIHJldHVybiBmcm9tKHRoaXMsIGFyZywgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxufVxuXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyIC8vIG5vdCB1c2VkIGJ5IHRoaXMgaW1wbGVtZW50YXRpb25cblxuLy8gVE9ETzogTGVnYWN5LCBub3QgbmVlZGVkIGFueW1vcmUuIFJlbW92ZSBpbiBuZXh0IG1ham9yIHZlcnNpb24uXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiAoYXJyKSB7XG4gIGFyci5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIHJldHVybiBhcnJcbn1cblxuZnVuY3Rpb24gZnJvbSAodGhhdCwgdmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1widmFsdWVcIiBhcmd1bWVudCBtdXN0IG5vdCBiZSBhIG51bWJlcicpXG4gIH1cblxuICBpZiAodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJyAmJiB2YWx1ZSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgcmV0dXJuIGZyb21BcnJheUJ1ZmZlcih0aGF0LCB2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxuICB9XG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gZnJvbVN0cmluZyh0aGF0LCB2YWx1ZSwgZW5jb2RpbmdPck9mZnNldClcbiAgfVxuXG4gIHJldHVybiBmcm9tT2JqZWN0KHRoYXQsIHZhbHVlKVxufVxuXG4vKipcbiAqIEZ1bmN0aW9uYWxseSBlcXVpdmFsZW50IHRvIEJ1ZmZlcihhcmcsIGVuY29kaW5nKSBidXQgdGhyb3dzIGEgVHlwZUVycm9yXG4gKiBpZiB2YWx1ZSBpcyBhIG51bWJlci5cbiAqIEJ1ZmZlci5mcm9tKHN0clssIGVuY29kaW5nXSlcbiAqIEJ1ZmZlci5mcm9tKGFycmF5KVxuICogQnVmZmVyLmZyb20oYnVmZmVyKVxuICogQnVmZmVyLmZyb20oYXJyYXlCdWZmZXJbLCBieXRlT2Zmc2V0WywgbGVuZ3RoXV0pXG4gKiovXG5CdWZmZXIuZnJvbSA9IGZ1bmN0aW9uICh2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBmcm9tKG51bGwsIHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG59XG5cbmlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICBCdWZmZXIucHJvdG90eXBlLl9fcHJvdG9fXyA9IFVpbnQ4QXJyYXkucHJvdG90eXBlXG4gIEJ1ZmZlci5fX3Byb3RvX18gPSBVaW50OEFycmF5XG4gIGlmICh0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wuc3BlY2llcyAmJlxuICAgICAgQnVmZmVyW1N5bWJvbC5zcGVjaWVzXSA9PT0gQnVmZmVyKSB7XG4gICAgLy8gRml4IHN1YmFycmF5KCkgaW4gRVMyMDE2LiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9mZXJvc3MvYnVmZmVyL3B1bGwvOTdcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQnVmZmVyLCBTeW1ib2wuc3BlY2llcywge1xuICAgICAgdmFsdWU6IG51bGwsXG4gICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KVxuICB9XG59XG5cbmZ1bmN0aW9uIGFzc2VydFNpemUgKHNpemUpIHtcbiAgaWYgKHR5cGVvZiBzaXplICE9PSAnbnVtYmVyJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wic2l6ZVwiIGFyZ3VtZW50IG11c3QgYmUgYSBudW1iZXInKVxuICB9XG59XG5cbmZ1bmN0aW9uIGFsbG9jICh0aGF0LCBzaXplLCBmaWxsLCBlbmNvZGluZykge1xuICBhc3NlcnRTaXplKHNpemUpXG4gIGlmIChzaXplIDw9IDApIHtcbiAgICByZXR1cm4gY3JlYXRlQnVmZmVyKHRoYXQsIHNpemUpXG4gIH1cbiAgaWYgKGZpbGwgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIE9ubHkgcGF5IGF0dGVudGlvbiB0byBlbmNvZGluZyBpZiBpdCdzIGEgc3RyaW5nLiBUaGlzXG4gICAgLy8gcHJldmVudHMgYWNjaWRlbnRhbGx5IHNlbmRpbmcgaW4gYSBudW1iZXIgdGhhdCB3b3VsZFxuICAgIC8vIGJlIGludGVycHJldHRlZCBhcyBhIHN0YXJ0IG9mZnNldC5cbiAgICByZXR1cm4gdHlwZW9mIGVuY29kaW5nID09PSAnc3RyaW5nJ1xuICAgICAgPyBjcmVhdGVCdWZmZXIodGhhdCwgc2l6ZSkuZmlsbChmaWxsLCBlbmNvZGluZylcbiAgICAgIDogY3JlYXRlQnVmZmVyKHRoYXQsIHNpemUpLmZpbGwoZmlsbClcbiAgfVxuICByZXR1cm4gY3JlYXRlQnVmZmVyKHRoYXQsIHNpemUpXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBmaWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICogYWxsb2Moc2l6ZVssIGZpbGxbLCBlbmNvZGluZ11dKVxuICoqL1xuQnVmZmVyLmFsbG9jID0gZnVuY3Rpb24gKHNpemUsIGZpbGwsIGVuY29kaW5nKSB7XG4gIHJldHVybiBhbGxvYyhudWxsLCBzaXplLCBmaWxsLCBlbmNvZGluZylcbn1cblxuZnVuY3Rpb24gYWxsb2NVbnNhZmUgKHRoYXQsIHNpemUpIHtcbiAgYXNzZXJ0U2l6ZShzaXplKVxuICB0aGF0ID0gY3JlYXRlQnVmZmVyKHRoYXQsIHNpemUgPCAwID8gMCA6IGNoZWNrZWQoc2l6ZSkgfCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzaXplOyArK2kpIHtcbiAgICAgIHRoYXRbaV0gPSAwXG4gICAgfVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbi8qKlxuICogRXF1aXZhbGVudCB0byBCdWZmZXIobnVtKSwgYnkgZGVmYXVsdCBjcmVhdGVzIGEgbm9uLXplcm8tZmlsbGVkIEJ1ZmZlciBpbnN0YW5jZS5cbiAqICovXG5CdWZmZXIuYWxsb2NVbnNhZmUgPSBmdW5jdGlvbiAoc2l6ZSkge1xuICByZXR1cm4gYWxsb2NVbnNhZmUobnVsbCwgc2l6ZSlcbn1cbi8qKlxuICogRXF1aXZhbGVudCB0byBTbG93QnVmZmVyKG51bSksIGJ5IGRlZmF1bHQgY3JlYXRlcyBhIG5vbi16ZXJvLWZpbGxlZCBCdWZmZXIgaW5zdGFuY2UuXG4gKi9cbkJ1ZmZlci5hbGxvY1Vuc2FmZVNsb3cgPSBmdW5jdGlvbiAoc2l6ZSkge1xuICByZXR1cm4gYWxsb2NVbnNhZmUobnVsbCwgc2l6ZSlcbn1cblxuZnVuY3Rpb24gZnJvbVN0cmluZyAodGhhdCwgc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJyB8fCBlbmNvZGluZyA9PT0gJycpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICB9XG5cbiAgaWYgKCFCdWZmZXIuaXNFbmNvZGluZyhlbmNvZGluZykpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImVuY29kaW5nXCIgbXVzdCBiZSBhIHZhbGlkIHN0cmluZyBlbmNvZGluZycpXG4gIH1cblxuICB2YXIgbGVuZ3RoID0gYnl0ZUxlbmd0aChzdHJpbmcsIGVuY29kaW5nKSB8IDBcbiAgdGhhdCA9IGNyZWF0ZUJ1ZmZlcih0aGF0LCBsZW5ndGgpXG5cbiAgdGhhdC53cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlMaWtlICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gY3JlYXRlQnVmZmVyKHRoYXQsIGxlbmd0aClcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUJ1ZmZlciAodGhhdCwgYXJyYXksIGJ5dGVPZmZzZXQsIGxlbmd0aCkge1xuICBhcnJheS5ieXRlTGVuZ3RoIC8vIHRoaXMgdGhyb3dzIGlmIGBhcnJheWAgaXMgbm90IGEgdmFsaWQgQXJyYXlCdWZmZXJcblxuICBpZiAoYnl0ZU9mZnNldCA8IDAgfHwgYXJyYXkuYnl0ZUxlbmd0aCA8IGJ5dGVPZmZzZXQpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXFwnb2Zmc2V0XFwnIGlzIG91dCBvZiBib3VuZHMnKVxuICB9XG5cbiAgaWYgKGFycmF5LmJ5dGVMZW5ndGggPCBieXRlT2Zmc2V0ICsgKGxlbmd0aCB8fCAwKSkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdcXCdsZW5ndGhcXCcgaXMgb3V0IG9mIGJvdW5kcycpXG4gIH1cblxuICBpZiAoYnl0ZU9mZnNldCA9PT0gdW5kZWZpbmVkICYmIGxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgYXJyYXkgPSBuZXcgVWludDhBcnJheShhcnJheSlcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXksIGJ5dGVPZmZzZXQpXG4gIH0gZWxzZSB7XG4gICAgYXJyYXkgPSBuZXcgVWludDhBcnJheShhcnJheSwgYnl0ZU9mZnNldCwgbGVuZ3RoKVxuICB9XG5cbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UsIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgdGhhdCA9IGFycmF5XG4gICAgdGhhdC5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBhbiBvYmplY3QgaW5zdGFuY2Ugb2YgdGhlIEJ1ZmZlciBjbGFzc1xuICAgIHRoYXQgPSBmcm9tQXJyYXlMaWtlKHRoYXQsIGFycmF5KVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21PYmplY3QgKHRoYXQsIG9iaikge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKG9iaikpIHtcbiAgICB2YXIgbGVuID0gY2hlY2tlZChvYmoubGVuZ3RoKSB8IDBcbiAgICB0aGF0ID0gY3JlYXRlQnVmZmVyKHRoYXQsIGxlbilcblxuICAgIGlmICh0aGF0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHRoYXRcbiAgICB9XG5cbiAgICBvYmouY29weSh0aGF0LCAwLCAwLCBsZW4pXG4gICAgcmV0dXJuIHRoYXRcbiAgfVxuXG4gIGlmIChvYmopIHtcbiAgICBpZiAoKHR5cGVvZiBBcnJheUJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgICAgb2JqLmJ1ZmZlciBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB8fCAnbGVuZ3RoJyBpbiBvYmopIHtcbiAgICAgIGlmICh0eXBlb2Ygb2JqLmxlbmd0aCAhPT0gJ251bWJlcicgfHwgaXNuYW4ob2JqLmxlbmd0aCkpIHtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcih0aGF0LCAwKVxuICAgICAgfVxuICAgICAgcmV0dXJuIGZyb21BcnJheUxpa2UodGhhdCwgb2JqKVxuICAgIH1cblxuICAgIGlmIChvYmoudHlwZSA9PT0gJ0J1ZmZlcicgJiYgaXNBcnJheShvYmouZGF0YSkpIHtcbiAgICAgIHJldHVybiBmcm9tQXJyYXlMaWtlKHRoYXQsIG9iai5kYXRhKVxuICAgIH1cbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ZpcnN0IGFyZ3VtZW50IG11c3QgYmUgYSBzdHJpbmcsIEJ1ZmZlciwgQXJyYXlCdWZmZXIsIEFycmF5LCBvciBhcnJheS1saWtlIG9iamVjdC4nKVxufVxuXG5mdW5jdGlvbiBjaGVja2VkIChsZW5ndGgpIHtcbiAgLy8gTm90ZTogY2Fubm90IHVzZSBgbGVuZ3RoIDwga01heExlbmd0aGAgaGVyZSBiZWNhdXNlIHRoYXQgZmFpbHMgd2hlblxuICAvLyBsZW5ndGggaXMgTmFOICh3aGljaCBpcyBvdGhlcndpc2UgY29lcmNlZCB0byB6ZXJvLilcbiAgaWYgKGxlbmd0aCA+PSBrTWF4TGVuZ3RoKCkpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byBhbGxvY2F0ZSBCdWZmZXIgbGFyZ2VyIHRoYW4gbWF4aW11bSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAnc2l6ZTogMHgnICsga01heExlbmd0aCgpLnRvU3RyaW5nKDE2KSArICcgYnl0ZXMnKVxuICB9XG4gIHJldHVybiBsZW5ndGggfCAwXG59XG5cbmZ1bmN0aW9uIFNsb3dCdWZmZXIgKGxlbmd0aCkge1xuICBpZiAoK2xlbmd0aCAhPSBsZW5ndGgpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBlcWVxZXFcbiAgICBsZW5ndGggPSAwXG4gIH1cbiAgcmV0dXJuIEJ1ZmZlci5hbGxvYygrbGVuZ3RoKVxufVxuXG5CdWZmZXIuaXNCdWZmZXIgPSBmdW5jdGlvbiBpc0J1ZmZlciAoYikge1xuICByZXR1cm4gISEoYiAhPSBudWxsICYmIGIuX2lzQnVmZmVyKVxufVxuXG5CdWZmZXIuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKGEsIGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYSkgfHwgIUJ1ZmZlci5pc0J1ZmZlcihiKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyBtdXN0IGJlIEJ1ZmZlcnMnKVxuICB9XG5cbiAgaWYgKGEgPT09IGIpIHJldHVybiAwXG5cbiAgdmFyIHggPSBhLmxlbmd0aFxuICB2YXIgeSA9IGIubGVuZ3RoXG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IE1hdGgubWluKHgsIHkpOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkge1xuICAgICAgeCA9IGFbaV1cbiAgICAgIHkgPSBiW2ldXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuXG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiBpc0VuY29kaW5nIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgY2FzZSAncmF3JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIGNvbmNhdCAobGlzdCwgbGVuZ3RoKSB7XG4gIGlmICghaXNBcnJheShsaXN0KSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wibGlzdFwiIGFyZ3VtZW50IG11c3QgYmUgYW4gQXJyYXkgb2YgQnVmZmVycycpXG4gIH1cblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gQnVmZmVyLmFsbG9jKDApXG4gIH1cblxuICB2YXIgaVxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBsZW5ndGggPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyArK2kpIHtcbiAgICAgIGxlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWZmZXIgPSBCdWZmZXIuYWxsb2NVbnNhZmUobGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7ICsraSkge1xuICAgIHZhciBidWYgPSBsaXN0W2ldXG4gICAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJsaXN0XCIgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzJylcbiAgICB9XG4gICAgYnVmLmNvcHkoYnVmZmVyLCBwb3MpXG4gICAgcG9zICs9IGJ1Zi5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmZmVyXG59XG5cbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihzdHJpbmcpKSB7XG4gICAgcmV0dXJuIHN0cmluZy5sZW5ndGhcbiAgfVxuICBpZiAodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgQXJyYXlCdWZmZXIuaXNWaWV3ID09PSAnZnVuY3Rpb24nICYmXG4gICAgICAoQXJyYXlCdWZmZXIuaXNWaWV3KHN0cmluZykgfHwgc3RyaW5nIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpKSB7XG4gICAgcmV0dXJuIHN0cmluZy5ieXRlTGVuZ3RoXG4gIH1cbiAgaWYgKHR5cGVvZiBzdHJpbmcgIT09ICdzdHJpbmcnKSB7XG4gICAgc3RyaW5nID0gJycgKyBzdHJpbmdcbiAgfVxuXG4gIHZhciBsZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChsZW4gPT09IDApIHJldHVybiAwXG5cbiAgLy8gVXNlIGEgZm9yIGxvb3AgdG8gYXZvaWQgcmVjdXJzaW9uXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgY2FzZSAncmF3JzpcbiAgICAgIGNhc2UgJ3Jhd3MnOlxuICAgICAgICByZXR1cm4gbGVuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIGNhc2UgdW5kZWZpbmVkOlxuICAgICAgICByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiBsZW4gKiAyXG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gbGVuID4+PiAxXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGggLy8gYXNzdW1lIHV0ZjhcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cbkJ1ZmZlci5ieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aFxuXG5mdW5jdGlvbiBzbG93VG9TdHJpbmcgKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG5cbiAgLy8gTm8gbmVlZCB0byB2ZXJpZnkgdGhhdCBcInRoaXMubGVuZ3RoIDw9IE1BWF9VSU5UMzJcIiBzaW5jZSBpdCdzIGEgcmVhZC1vbmx5XG4gIC8vIHByb3BlcnR5IG9mIGEgdHlwZWQgYXJyYXkuXG5cbiAgLy8gVGhpcyBiZWhhdmVzIG5laXRoZXIgbGlrZSBTdHJpbmcgbm9yIFVpbnQ4QXJyYXkgaW4gdGhhdCB3ZSBzZXQgc3RhcnQvZW5kXG4gIC8vIHRvIHRoZWlyIHVwcGVyL2xvd2VyIGJvdW5kcyBpZiB0aGUgdmFsdWUgcGFzc2VkIGlzIG91dCBvZiByYW5nZS5cbiAgLy8gdW5kZWZpbmVkIGlzIGhhbmRsZWQgc3BlY2lhbGx5IGFzIHBlciBFQ01BLTI2MiA2dGggRWRpdGlvbixcbiAgLy8gU2VjdGlvbiAxMy4zLjMuNyBSdW50aW1lIFNlbWFudGljczogS2V5ZWRCaW5kaW5nSW5pdGlhbGl6YXRpb24uXG4gIGlmIChzdGFydCA9PT0gdW5kZWZpbmVkIHx8IHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ID0gMFxuICB9XG4gIC8vIFJldHVybiBlYXJseSBpZiBzdGFydCA+IHRoaXMubGVuZ3RoLiBEb25lIGhlcmUgdG8gcHJldmVudCBwb3RlbnRpYWwgdWludDMyXG4gIC8vIGNvZXJjaW9uIGZhaWwgYmVsb3cuXG4gIGlmIChzdGFydCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgcmV0dXJuICcnXG4gIH1cblxuICBpZiAoZW5kID09PSB1bmRlZmluZWQgfHwgZW5kID4gdGhpcy5sZW5ndGgpIHtcbiAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICB9XG5cbiAgaWYgKGVuZCA8PSAwKSB7XG4gICAgcmV0dXJuICcnXG4gIH1cblxuICAvLyBGb3JjZSBjb2Vyc2lvbiB0byB1aW50MzIuIFRoaXMgd2lsbCBhbHNvIGNvZXJjZSBmYWxzZXkvTmFOIHZhbHVlcyB0byAwLlxuICBlbmQgPj4+PSAwXG4gIHN0YXJ0ID4+Pj0gMFxuXG4gIGlmIChlbmQgPD0gc3RhcnQpIHtcbiAgICByZXR1cm4gJydcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gYmluYXJ5U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1dGYxNmxlU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKGVuY29kaW5nICsgJycpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbi8vIFRoZSBwcm9wZXJ0eSBpcyB1c2VkIGJ5IGBCdWZmZXIuaXNCdWZmZXJgIGFuZCBgaXMtYnVmZmVyYCAoaW4gU2FmYXJpIDUtNykgdG8gZGV0ZWN0XG4vLyBCdWZmZXIgaW5zdGFuY2VzLlxuQnVmZmVyLnByb3RvdHlwZS5faXNCdWZmZXIgPSB0cnVlXG5cbmZ1bmN0aW9uIHN3YXAgKGIsIG4sIG0pIHtcbiAgdmFyIGkgPSBiW25dXG4gIGJbbl0gPSBiW21dXG4gIGJbbV0gPSBpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc3dhcDE2ID0gZnVuY3Rpb24gc3dhcDE2ICgpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGlmIChsZW4gJSAyICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0J1ZmZlciBzaXplIG11c3QgYmUgYSBtdWx0aXBsZSBvZiAxNi1iaXRzJylcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSAyKSB7XG4gICAgc3dhcCh0aGlzLCBpLCBpICsgMSlcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnN3YXAzMiA9IGZ1bmN0aW9uIHN3YXAzMiAoKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuICUgNCAhPT0gMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdCdWZmZXIgc2l6ZSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgMzItYml0cycpXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gNCkge1xuICAgIHN3YXAodGhpcywgaSwgaSArIDMpXG4gICAgc3dhcCh0aGlzLCBpICsgMSwgaSArIDIpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nICgpIHtcbiAgdmFyIGxlbmd0aCA9IHRoaXMubGVuZ3RoIHwgMFxuICBpZiAobGVuZ3RoID09PSAwKSByZXR1cm4gJydcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHJldHVybiB1dGY4U2xpY2UodGhpcywgMCwgbGVuZ3RoKVxuICByZXR1cm4gc2xvd1RvU3RyaW5nLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiBlcXVhbHMgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIHRydWVcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpID09PSAwXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uIGluc3BlY3QgKCkge1xuICB2YXIgc3RyID0gJydcbiAgdmFyIG1heCA9IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVNcbiAgaWYgKHRoaXMubGVuZ3RoID4gMCkge1xuICAgIHN0ciA9IHRoaXMudG9TdHJpbmcoJ2hleCcsIDAsIG1heCkubWF0Y2goLy57Mn0vZykuam9pbignICcpXG4gICAgaWYgKHRoaXMubGVuZ3RoID4gbWF4KSBzdHIgKz0gJyAuLi4gJ1xuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgc3RyICsgJz4nXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKHRhcmdldCwgc3RhcnQsIGVuZCwgdGhpc1N0YXJ0LCB0aGlzRW5kKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKHRhcmdldCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgfVxuXG4gIGlmIChzdGFydCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgc3RhcnQgPSAwXG4gIH1cbiAgaWYgKGVuZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZW5kID0gdGFyZ2V0ID8gdGFyZ2V0Lmxlbmd0aCA6IDBcbiAgfVxuICBpZiAodGhpc1N0YXJ0ID09PSB1bmRlZmluZWQpIHtcbiAgICB0aGlzU3RhcnQgPSAwXG4gIH1cbiAgaWYgKHRoaXNFbmQgPT09IHVuZGVmaW5lZCkge1xuICAgIHRoaXNFbmQgPSB0aGlzLmxlbmd0aFxuICB9XG5cbiAgaWYgKHN0YXJ0IDwgMCB8fCBlbmQgPiB0YXJnZXQubGVuZ3RoIHx8IHRoaXNTdGFydCA8IDAgfHwgdGhpc0VuZCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ291dCBvZiByYW5nZSBpbmRleCcpXG4gIH1cblxuICBpZiAodGhpc1N0YXJ0ID49IHRoaXNFbmQgJiYgc3RhcnQgPj0gZW5kKSB7XG4gICAgcmV0dXJuIDBcbiAgfVxuICBpZiAodGhpc1N0YXJ0ID49IHRoaXNFbmQpIHtcbiAgICByZXR1cm4gLTFcbiAgfVxuICBpZiAoc3RhcnQgPj0gZW5kKSB7XG4gICAgcmV0dXJuIDFcbiAgfVxuXG4gIHN0YXJ0ID4+Pj0gMFxuICBlbmQgPj4+PSAwXG4gIHRoaXNTdGFydCA+Pj49IDBcbiAgdGhpc0VuZCA+Pj49IDBcblxuICBpZiAodGhpcyA9PT0gdGFyZ2V0KSByZXR1cm4gMFxuXG4gIHZhciB4ID0gdGhpc0VuZCAtIHRoaXNTdGFydFxuICB2YXIgeSA9IGVuZCAtIHN0YXJ0XG4gIHZhciBsZW4gPSBNYXRoLm1pbih4LCB5KVxuXG4gIHZhciB0aGlzQ29weSA9IHRoaXMuc2xpY2UodGhpc1N0YXJ0LCB0aGlzRW5kKVxuICB2YXIgdGFyZ2V0Q29weSA9IHRhcmdldC5zbGljZShzdGFydCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAodGhpc0NvcHlbaV0gIT09IHRhcmdldENvcHlbaV0pIHtcbiAgICAgIHggPSB0aGlzQ29weVtpXVxuICAgICAgeSA9IHRhcmdldENvcHlbaV1cbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgaWYgKHggPCB5KSByZXR1cm4gLTFcbiAgaWYgKHkgPCB4KSByZXR1cm4gMVxuICByZXR1cm4gMFxufVxuXG5mdW5jdGlvbiBhcnJheUluZGV4T2YgKGFyciwgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykge1xuICB2YXIgaW5kZXhTaXplID0gMVxuICB2YXIgYXJyTGVuZ3RoID0gYXJyLmxlbmd0aFxuICB2YXIgdmFsTGVuZ3RoID0gdmFsLmxlbmd0aFxuXG4gIGlmIChlbmNvZGluZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZW5jb2RpbmcgPSBTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICBpZiAoZW5jb2RpbmcgPT09ICd1Y3MyJyB8fCBlbmNvZGluZyA9PT0gJ3Vjcy0yJyB8fFxuICAgICAgICBlbmNvZGluZyA9PT0gJ3V0ZjE2bGUnIHx8IGVuY29kaW5nID09PSAndXRmLTE2bGUnKSB7XG4gICAgICBpZiAoYXJyLmxlbmd0aCA8IDIgfHwgdmFsLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgcmV0dXJuIC0xXG4gICAgICB9XG4gICAgICBpbmRleFNpemUgPSAyXG4gICAgICBhcnJMZW5ndGggLz0gMlxuICAgICAgdmFsTGVuZ3RoIC89IDJcbiAgICAgIGJ5dGVPZmZzZXQgLz0gMlxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWQgKGJ1ZiwgaSkge1xuICAgIGlmIChpbmRleFNpemUgPT09IDEpIHtcbiAgICAgIHJldHVybiBidWZbaV1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGJ1Zi5yZWFkVUludDE2QkUoaSAqIGluZGV4U2l6ZSlcbiAgICB9XG4gIH1cblxuICB2YXIgZm91bmRJbmRleCA9IC0xXG4gIGZvciAodmFyIGkgPSBieXRlT2Zmc2V0OyBpIDwgYXJyTGVuZ3RoOyArK2kpIHtcbiAgICBpZiAocmVhZChhcnIsIGkpID09PSByZWFkKHZhbCwgZm91bmRJbmRleCA9PT0gLTEgPyAwIDogaSAtIGZvdW5kSW5kZXgpKSB7XG4gICAgICBpZiAoZm91bmRJbmRleCA9PT0gLTEpIGZvdW5kSW5kZXggPSBpXG4gICAgICBpZiAoaSAtIGZvdW5kSW5kZXggKyAxID09PSB2YWxMZW5ndGgpIHJldHVybiBmb3VuZEluZGV4ICogaW5kZXhTaXplXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChmb3VuZEluZGV4ICE9PSAtMSkgaSAtPSBpIC0gZm91bmRJbmRleFxuICAgICAgZm91bmRJbmRleCA9IC0xXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIC0xXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5kZXhPZiA9IGZ1bmN0aW9uIGluZGV4T2YgKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBieXRlT2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gYnl0ZU9mZnNldFxuICAgIGJ5dGVPZmZzZXQgPSAwXG4gIH0gZWxzZSBpZiAoYnl0ZU9mZnNldCA+IDB4N2ZmZmZmZmYpIHtcbiAgICBieXRlT2Zmc2V0ID0gMHg3ZmZmZmZmZlxuICB9IGVsc2UgaWYgKGJ5dGVPZmZzZXQgPCAtMHg4MDAwMDAwMCkge1xuICAgIGJ5dGVPZmZzZXQgPSAtMHg4MDAwMDAwMFxuICB9XG4gIGJ5dGVPZmZzZXQgPj49IDBcblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVybiAtMVxuICBpZiAoYnl0ZU9mZnNldCA+PSB0aGlzLmxlbmd0aCkgcmV0dXJuIC0xXG5cbiAgLy8gTmVnYXRpdmUgb2Zmc2V0cyBzdGFydCBmcm9tIHRoZSBlbmQgb2YgdGhlIGJ1ZmZlclxuICBpZiAoYnl0ZU9mZnNldCA8IDApIGJ5dGVPZmZzZXQgPSBNYXRoLm1heCh0aGlzLmxlbmd0aCArIGJ5dGVPZmZzZXQsIDApXG5cbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgdmFsID0gQnVmZmVyLmZyb20odmFsLCBlbmNvZGluZylcbiAgfVxuXG4gIGlmIChCdWZmZXIuaXNCdWZmZXIodmFsKSkge1xuICAgIC8vIHNwZWNpYWwgY2FzZTogbG9va2luZyBmb3IgZW1wdHkgc3RyaW5nL2J1ZmZlciBhbHdheXMgZmFpbHNcbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIC0xXG4gICAgfVxuICAgIHJldHVybiBhcnJheUluZGV4T2YodGhpcywgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZylcbiAgfVxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgJiYgVWludDhBcnJheS5wcm90b3R5cGUuaW5kZXhPZiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YuY2FsbCh0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gICAgfVxuICAgIHJldHVybiBhcnJheUluZGV4T2YodGhpcywgWyB2YWwgXSwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpXG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKCd2YWwgbXVzdCBiZSBzdHJpbmcsIG51bWJlciBvciBCdWZmZXInKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluY2x1ZGVzID0gZnVuY3Rpb24gaW5jbHVkZXMgKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpIHtcbiAgcmV0dXJuIHRoaXMuaW5kZXhPZih2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSAhPT0gLTFcbn1cblxuZnVuY3Rpb24gaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAoc3RyTGVuICUgMiAhPT0gMCkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGhleCBzdHJpbmcnKVxuXG4gIGlmIChsZW5ndGggPiBzdHJMZW4gLyAyKSB7XG4gICAgbGVuZ3RoID0gc3RyTGVuIC8gMlxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgcGFyc2VkID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGlmIChpc05hTihwYXJzZWQpKSByZXR1cm4gaVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IHBhcnNlZFxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIHV0ZjhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjhUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGFzY2lpV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmluYXJ5V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYXNjaWlXcml0ZShidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJhc2U2NFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiB1Y3MyV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGYxNmxlVG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gd3JpdGUgKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcpXG4gIGlmIChvZmZzZXQgPT09IHVuZGVmaW5lZCkge1xuICAgIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiBvZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgb2Zmc2V0WywgbGVuZ3RoXVssIGVuY29kaW5nXSlcbiAgfSBlbHNlIGlmIChpc0Zpbml0ZShvZmZzZXQpKSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICAgIGlmIChpc0Zpbml0ZShsZW5ndGgpKSB7XG4gICAgICBsZW5ndGggPSBsZW5ndGggfCAwXG4gICAgICBpZiAoZW5jb2RpbmcgPT09IHVuZGVmaW5lZCkgZW5jb2RpbmcgPSAndXRmOCdcbiAgICB9IGVsc2Uge1xuICAgICAgZW5jb2RpbmcgPSBsZW5ndGhcbiAgICAgIGxlbmd0aCA9IHVuZGVmaW5lZFxuICAgIH1cbiAgLy8gbGVnYWN5IHdyaXRlKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldCwgbGVuZ3RoKSAtIHJlbW92ZSBpbiB2MC4xM1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdCdWZmZXIud3JpdGUoc3RyaW5nLCBlbmNvZGluZywgb2Zmc2V0WywgbGVuZ3RoXSkgaXMgbm8gbG9uZ2VyIHN1cHBvcnRlZCdcbiAgICApXG4gIH1cblxuICB2YXIgcmVtYWluaW5nID0gdGhpcy5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkIHx8IGxlbmd0aCA+IHJlbWFpbmluZykgbGVuZ3RoID0gcmVtYWluaW5nXG5cbiAgaWYgKChzdHJpbmcubGVuZ3RoID4gMCAmJiAobGVuZ3RoIDwgMCB8fCBvZmZzZXQgPCAwKSkgfHwgb2Zmc2V0ID4gdGhpcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byB3cml0ZSBvdXRzaWRlIGJ1ZmZlciBib3VuZHMnKVxuICB9XG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGJpbmFyeVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIC8vIFdhcm5pbmc6IG1heExlbmd0aCBub3QgdGFrZW4gaW50byBhY2NvdW50IGluIGJhc2U2NFdyaXRlXG4gICAgICAgIHJldHVybiBiYXNlNjRXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdWNzMldyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uIHRvSlNPTiAoKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0J1ZmZlcicsXG4gICAgZGF0YTogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5fYXJyIHx8IHRoaXMsIDApXG4gIH1cbn1cblxuZnVuY3Rpb24gYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIHV0ZjhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcbiAgdmFyIHJlcyA9IFtdXG5cbiAgdmFyIGkgPSBzdGFydFxuICB3aGlsZSAoaSA8IGVuZCkge1xuICAgIHZhciBmaXJzdEJ5dGUgPSBidWZbaV1cbiAgICB2YXIgY29kZVBvaW50ID0gbnVsbFxuICAgIHZhciBieXRlc1BlclNlcXVlbmNlID0gKGZpcnN0Qnl0ZSA+IDB4RUYpID8gNFxuICAgICAgOiAoZmlyc3RCeXRlID4gMHhERikgPyAzXG4gICAgICA6IChmaXJzdEJ5dGUgPiAweEJGKSA/IDJcbiAgICAgIDogMVxuXG4gICAgaWYgKGkgKyBieXRlc1BlclNlcXVlbmNlIDw9IGVuZCkge1xuICAgICAgdmFyIHNlY29uZEJ5dGUsIHRoaXJkQnl0ZSwgZm91cnRoQnl0ZSwgdGVtcENvZGVQb2ludFxuXG4gICAgICBzd2l0Y2ggKGJ5dGVzUGVyU2VxdWVuY2UpIHtcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgIGlmIChmaXJzdEJ5dGUgPCAweDgwKSB7XG4gICAgICAgICAgICBjb2RlUG9pbnQgPSBmaXJzdEJ5dGVcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHgxRikgPDwgMHg2IHwgKHNlY29uZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4QyB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKHRoaXJkQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0ZGICYmICh0ZW1wQ29kZVBvaW50IDwgMHhEODAwIHx8IHRlbXBDb2RlUG9pbnQgPiAweERGRkYpKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSA0OlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGZvdXJ0aEJ5dGUgPSBidWZbaSArIDNdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwICYmIChmb3VydGhCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweDEyIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweEMgfCAodGhpcmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKGZvdXJ0aEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweEZGRkYgJiYgdGVtcENvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNvZGVQb2ludCA9PT0gbnVsbCkge1xuICAgICAgLy8gd2UgZGlkIG5vdCBnZW5lcmF0ZSBhIHZhbGlkIGNvZGVQb2ludCBzbyBpbnNlcnQgYVxuICAgICAgLy8gcmVwbGFjZW1lbnQgY2hhciAoVStGRkZEKSBhbmQgYWR2YW5jZSBvbmx5IDEgYnl0ZVxuICAgICAgY29kZVBvaW50ID0gMHhGRkZEXG4gICAgICBieXRlc1BlclNlcXVlbmNlID0gMVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50ID4gMHhGRkZGKSB7XG4gICAgICAvLyBlbmNvZGUgdG8gdXRmMTYgKHN1cnJvZ2F0ZSBwYWlyIGRhbmNlKVxuICAgICAgY29kZVBvaW50IC09IDB4MTAwMDBcbiAgICAgIHJlcy5wdXNoKGNvZGVQb2ludCA+Pj4gMTAgJiAweDNGRiB8IDB4RDgwMClcbiAgICAgIGNvZGVQb2ludCA9IDB4REMwMCB8IGNvZGVQb2ludCAmIDB4M0ZGXG4gICAgfVxuXG4gICAgcmVzLnB1c2goY29kZVBvaW50KVxuICAgIGkgKz0gYnl0ZXNQZXJTZXF1ZW5jZVxuICB9XG5cbiAgcmV0dXJuIGRlY29kZUNvZGVQb2ludHNBcnJheShyZXMpXG59XG5cbi8vIEJhc2VkIG9uIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzIyNzQ3MjcyLzY4MDc0MiwgdGhlIGJyb3dzZXIgd2l0aFxuLy8gdGhlIGxvd2VzdCBsaW1pdCBpcyBDaHJvbWUsIHdpdGggMHgxMDAwMCBhcmdzLlxuLy8gV2UgZ28gMSBtYWduaXR1ZGUgbGVzcywgZm9yIHNhZmV0eVxudmFyIE1BWF9BUkdVTUVOVFNfTEVOR1RIID0gMHgxMDAwXG5cbmZ1bmN0aW9uIGRlY29kZUNvZGVQb2ludHNBcnJheSAoY29kZVBvaW50cykge1xuICB2YXIgbGVuID0gY29kZVBvaW50cy5sZW5ndGhcbiAgaWYgKGxlbiA8PSBNQVhfQVJHVU1FTlRTX0xFTkdUSCkge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFN0cmluZywgY29kZVBvaW50cykgLy8gYXZvaWQgZXh0cmEgc2xpY2UoKVxuICB9XG5cbiAgLy8gRGVjb2RlIGluIGNodW5rcyB0byBhdm9pZCBcImNhbGwgc3RhY2sgc2l6ZSBleGNlZWRlZFwiLlxuICB2YXIgcmVzID0gJydcbiAgdmFyIGkgPSAwXG4gIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoXG4gICAgICBTdHJpbmcsXG4gICAgICBjb2RlUG9pbnRzLnNsaWNlKGksIGkgKz0gTUFYX0FSR1VNRU5UU19MRU5HVEgpXG4gICAgKVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0gJiAweDdGKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gYmluYXJ5U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiB1dGYxNmxlU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgYnl0ZXMgPSBidWYuc2xpY2Uoc3RhcnQsIGVuZClcbiAgdmFyIHJlcyA9ICcnXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpXSArIGJ5dGVzW2kgKyAxXSAqIDI1NilcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbiBzbGljZSAoc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgc3RhcnQgPSB+fnN0YXJ0XG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkID8gbGVuIDogfn5lbmRcblxuICBpZiAoc3RhcnQgPCAwKSB7XG4gICAgc3RhcnQgKz0gbGVuXG4gICAgaWYgKHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIH0gZWxzZSBpZiAoc3RhcnQgPiBsZW4pIHtcbiAgICBzdGFydCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IDApIHtcbiAgICBlbmQgKz0gbGVuXG4gICAgaWYgKGVuZCA8IDApIGVuZCA9IDBcbiAgfSBlbHNlIGlmIChlbmQgPiBsZW4pIHtcbiAgICBlbmQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICB2YXIgbmV3QnVmXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIG5ld0J1ZiA9IHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZClcbiAgICBuZXdCdWYuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIHZhciBzbGljZUxlbiA9IGVuZCAtIHN0YXJ0XG4gICAgbmV3QnVmID0gbmV3IEJ1ZmZlcihzbGljZUxlbiwgdW5kZWZpbmVkKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2xpY2VMZW47ICsraSkge1xuICAgICAgbmV3QnVmW2ldID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5ld0J1ZlxufVxuXG4vKlxuICogTmVlZCB0byBtYWtlIHN1cmUgdGhhdCBidWZmZXIgaXNuJ3QgdHJ5aW5nIHRvIHdyaXRlIG91dCBvZiBib3VuZHMuXG4gKi9cbmZ1bmN0aW9uIGNoZWNrT2Zmc2V0IChvZmZzZXQsIGV4dCwgbGVuZ3RoKSB7XG4gIGlmICgob2Zmc2V0ICUgMSkgIT09IDAgfHwgb2Zmc2V0IDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ29mZnNldCBpcyBub3QgdWludCcpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBsZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdUcnlpbmcgdG8gYWNjZXNzIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludExFID0gZnVuY3Rpb24gcmVhZFVJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludEJFID0gZnVuY3Rpb24gcmVhZFVJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcbiAgfVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF1cbiAgdmFyIG11bCA9IDFcbiAgd2hpbGUgKGJ5dGVMZW5ndGggPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50OCA9IGZ1bmN0aW9uIHJlYWRVSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkxFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCA4KSB8IHRoaXNbb2Zmc2V0ICsgMV1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiByZWFkVUludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKCh0aGlzW29mZnNldF0pIHxcbiAgICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSkgK1xuICAgICAgKHRoaXNbb2Zmc2V0ICsgM10gKiAweDEwMDAwMDApXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkJFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gKiAweDEwMDAwMDApICtcbiAgICAoKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgdGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50TEUgPSBmdW5jdGlvbiByZWFkSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50QkUgPSBmdW5jdGlvbiByZWFkSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgaSA9IGJ5dGVMZW5ndGhcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1pXVxuICB3aGlsZSAoaSA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50OCA9IGZ1bmN0aW9uIHJlYWRJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIGlmICghKHRoaXNbb2Zmc2V0XSAmIDB4ODApKSByZXR1cm4gKHRoaXNbb2Zmc2V0XSlcbiAgcmV0dXJuICgoMHhmZiAtIHRoaXNbb2Zmc2V0XSArIDEpICogLTEpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2TEUgPSBmdW5jdGlvbiByZWFkSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkJFID0gZnVuY3Rpb24gcmVhZEludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgMV0gfCAodGhpc1tvZmZzZXRdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0pIHxcbiAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAzXSA8PCAyNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRJbnQzMkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgMjQpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRMRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdExFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdEJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUxFID0gZnVuY3Rpb24gcmVhZERvdWJsZUxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlQkUgPSBmdW5jdGlvbiByZWFkRG91YmxlQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCA1MiwgOClcbn1cblxuZnVuY3Rpb24gY2hlY2tJbnQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihidWYpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImJ1ZmZlclwiIGFyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXIgaW5zdGFuY2UnKVxuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBSYW5nZUVycm9yKCdcInZhbHVlXCIgYXJndW1lbnQgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlVUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIG1heEJ5dGVzID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpIC0gMVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG1heEJ5dGVzLCAwKVxuICB9XG5cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlVUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIG1heEJ5dGVzID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpIC0gMVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG1heEJ5dGVzLCAwKVxuICB9XG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVVSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweGZmLCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDIpOyBpIDwgajsgKytpKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCA0KTsgaSA8IGo7ICsraSkge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZVVJbnQzMkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSAwXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIGlmICh2YWx1ZSA8IDAgJiYgc3ViID09PSAwICYmIHRoaXNbb2Zmc2V0ICsgaSAtIDFdICE9PSAwKSB7XG4gICAgICBzdWIgPSAxXG4gICAgfVxuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gMFxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIGlmICh2YWx1ZSA8IDAgJiYgc3ViID09PSAwICYmIHRoaXNbb2Zmc2V0ICsgaSArIDFdICE9PSAwKSB7XG4gICAgICBzdWIgPSAxXG4gICAgfVxuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4N2YsIC0weDgwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZiArIHZhbHVlICsgMVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkxFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmZmZmZmICsgdmFsdWUgKyAxXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5mdW5jdGlvbiBjaGVja0lFRUU3NTQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0luZGV4IG91dCBvZiByYW5nZScpXG4gIGlmIChvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuZnVuY3Rpb24gd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA0LCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA4LCAxLjc5NzY5MzEzNDg2MjMxNTdFKzMwOCwgLTEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxuICByZXR1cm4gb2Zmc2V0ICsgOFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlTEUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVCRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGNvcHkodGFyZ2V0QnVmZmVyLCB0YXJnZXRTdGFydD0wLCBzb3VyY2VTdGFydD0wLCBzb3VyY2VFbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uIGNvcHkgKHRhcmdldCwgdGFyZ2V0U3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kICYmIGVuZCAhPT0gMCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldFN0YXJ0ID49IHRhcmdldC5sZW5ndGgpIHRhcmdldFN0YXJ0ID0gdGFyZ2V0Lmxlbmd0aFxuICBpZiAoIXRhcmdldFN0YXJ0KSB0YXJnZXRTdGFydCA9IDBcbiAgaWYgKGVuZCA+IDAgJiYgZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgLy8gQ29weSAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm4gMFxuICBpZiAodGFyZ2V0Lmxlbmd0aCA9PT0gMCB8fCB0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBGYXRhbCBlcnJvciBjb25kaXRpb25zXG4gIGlmICh0YXJnZXRTdGFydCA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIH1cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgPCBlbmQgLSBzdGFydCkge1xuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCArIHN0YXJ0XG4gIH1cblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcbiAgdmFyIGlcblxuICBpZiAodGhpcyA9PT0gdGFyZ2V0ICYmIHN0YXJ0IDwgdGFyZ2V0U3RhcnQgJiYgdGFyZ2V0U3RhcnQgPCBlbmQpIHtcbiAgICAvLyBkZXNjZW5kaW5nIGNvcHkgZnJvbSBlbmRcbiAgICBmb3IgKGkgPSBsZW4gLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSBpZiAobGVuIDwgMTAwMCB8fCAhQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBhc2NlbmRpbmcgY29weSBmcm9tIHN0YXJ0XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBVaW50OEFycmF5LnByb3RvdHlwZS5zZXQuY2FsbChcbiAgICAgIHRhcmdldCxcbiAgICAgIHRoaXMuc3ViYXJyYXkoc3RhcnQsIHN0YXJ0ICsgbGVuKSxcbiAgICAgIHRhcmdldFN0YXJ0XG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIGxlblxufVxuXG4vLyBVc2FnZTpcbi8vICAgIGJ1ZmZlci5maWxsKG51bWJlclssIG9mZnNldFssIGVuZF1dKVxuLy8gICAgYnVmZmVyLmZpbGwoYnVmZmVyWywgb2Zmc2V0WywgZW5kXV0pXG4vLyAgICBidWZmZXIuZmlsbChzdHJpbmdbLCBvZmZzZXRbLCBlbmRdXVssIGVuY29kaW5nXSlcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uIGZpbGwgKHZhbCwgc3RhcnQsIGVuZCwgZW5jb2RpbmcpIHtcbiAgLy8gSGFuZGxlIHN0cmluZyBjYXNlczpcbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKHR5cGVvZiBzdGFydCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGVuY29kaW5nID0gc3RhcnRcbiAgICAgIHN0YXJ0ID0gMFxuICAgICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBlbmQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbmNvZGluZyA9IGVuZFxuICAgICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgICB9XG4gICAgaWYgKHZhbC5sZW5ndGggPT09IDEpIHtcbiAgICAgIHZhciBjb2RlID0gdmFsLmNoYXJDb2RlQXQoMClcbiAgICAgIGlmIChjb2RlIDwgMjU2KSB7XG4gICAgICAgIHZhbCA9IGNvZGVcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGVuY29kaW5nICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignZW5jb2RpbmcgbXVzdCBiZSBhIHN0cmluZycpXG4gICAgfVxuICAgIGlmICh0eXBlb2YgZW5jb2RpbmcgPT09ICdzdHJpbmcnICYmICFCdWZmZXIuaXNFbmNvZGluZyhlbmNvZGluZykpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICB2YWwgPSB2YWwgJiAyNTVcbiAgfVxuXG4gIC8vIEludmFsaWQgcmFuZ2VzIGFyZSBub3Qgc2V0IHRvIGEgZGVmYXVsdCwgc28gY2FuIHJhbmdlIGNoZWNrIGVhcmx5LlxuICBpZiAoc3RhcnQgPCAwIHx8IHRoaXMubGVuZ3RoIDwgc3RhcnQgfHwgdGhpcy5sZW5ndGggPCBlbmQpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignT3V0IG9mIHJhbmdlIGluZGV4JylcbiAgfVxuXG4gIGlmIChlbmQgPD0gc3RhcnQpIHtcbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgc3RhcnQgPSBzdGFydCA+Pj4gMFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IHRoaXMubGVuZ3RoIDogZW5kID4+PiAwXG5cbiAgaWYgKCF2YWwpIHZhbCA9IDBcblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgICB0aGlzW2ldID0gdmFsXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhciBieXRlcyA9IEJ1ZmZlci5pc0J1ZmZlcih2YWwpXG4gICAgICA/IHZhbFxuICAgICAgOiB1dGY4VG9CeXRlcyhuZXcgQnVmZmVyKHZhbCwgZW5jb2RpbmcpLnRvU3RyaW5nKCkpXG4gICAgdmFyIGxlbiA9IGJ5dGVzLmxlbmd0aFxuICAgIGZvciAoaSA9IDA7IGkgPCBlbmQgLSBzdGFydDsgKytpKSB7XG4gICAgICB0aGlzW2kgKyBzdGFydF0gPSBieXRlc1tpICUgbGVuXVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIEhFTFBFUiBGVU5DVElPTlNcbi8vID09PT09PT09PT09PT09PT1cblxudmFyIElOVkFMSURfQkFTRTY0X1JFID0gL1teK1xcLzAtOUEtWmEtei1fXS9nXG5cbmZ1bmN0aW9uIGJhc2U2NGNsZWFuIChzdHIpIHtcbiAgLy8gTm9kZSBzdHJpcHMgb3V0IGludmFsaWQgY2hhcmFjdGVycyBsaWtlIFxcbiBhbmQgXFx0IGZyb20gdGhlIHN0cmluZywgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHN0ciA9IHN0cmluZ3RyaW0oc3RyKS5yZXBsYWNlKElOVkFMSURfQkFTRTY0X1JFLCAnJylcbiAgLy8gTm9kZSBjb252ZXJ0cyBzdHJpbmdzIHdpdGggbGVuZ3RoIDwgMiB0byAnJ1xuICBpZiAoc3RyLmxlbmd0aCA8IDIpIHJldHVybiAnJ1xuICAvLyBOb2RlIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBiYXNlNjQgc3RyaW5ncyAobWlzc2luZyB0cmFpbGluZyA9PT0pLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgd2hpbGUgKHN0ci5sZW5ndGggJSA0ICE9PSAwKSB7XG4gICAgc3RyID0gc3RyICsgJz0nXG4gIH1cbiAgcmV0dXJuIHN0clxufVxuXG5mdW5jdGlvbiBzdHJpbmd0cmltIChzdHIpIHtcbiAgaWYgKHN0ci50cmltKSByZXR1cm4gc3RyLnRyaW0oKVxuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxufVxuXG5mdW5jdGlvbiB0b0hleCAobikge1xuICBpZiAobiA8IDE2KSByZXR1cm4gJzAnICsgbi50b1N0cmluZygxNilcbiAgcmV0dXJuIG4udG9TdHJpbmcoMTYpXG59XG5cbmZ1bmN0aW9uIHV0ZjhUb0J5dGVzIChzdHJpbmcsIHVuaXRzKSB7XG4gIHVuaXRzID0gdW5pdHMgfHwgSW5maW5pdHlcbiAgdmFyIGNvZGVQb2ludFxuICB2YXIgbGVuZ3RoID0gc3RyaW5nLmxlbmd0aFxuICB2YXIgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcbiAgdmFyIGJ5dGVzID0gW11cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgY29kZVBvaW50ID0gc3RyaW5nLmNoYXJDb2RlQXQoaSlcblxuICAgIC8vIGlzIHN1cnJvZ2F0ZSBjb21wb25lbnRcbiAgICBpZiAoY29kZVBvaW50ID4gMHhEN0ZGICYmIGNvZGVQb2ludCA8IDB4RTAwMCkge1xuICAgICAgLy8gbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICghbGVhZFN1cnJvZ2F0ZSkge1xuICAgICAgICAvLyBubyBsZWFkIHlldFxuICAgICAgICBpZiAoY29kZVBvaW50ID4gMHhEQkZGKSB7XG4gICAgICAgICAgLy8gdW5leHBlY3RlZCB0cmFpbFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH0gZWxzZSBpZiAoaSArIDEgPT09IGxlbmd0aCkge1xuICAgICAgICAgIC8vIHVucGFpcmVkIGxlYWRcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gdmFsaWQgbGVhZFxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG5cbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gMiBsZWFkcyBpbiBhIHJvd1xuICAgICAgaWYgKGNvZGVQb2ludCA8IDB4REMwMCkge1xuICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyB2YWxpZCBzdXJyb2dhdGUgcGFpclxuICAgICAgY29kZVBvaW50ID0gKGxlYWRTdXJyb2dhdGUgLSAweEQ4MDAgPDwgMTAgfCBjb2RlUG9pbnQgLSAweERDMDApICsgMHgxMDAwMFxuICAgIH0gZWxzZSBpZiAobGVhZFN1cnJvZ2F0ZSkge1xuICAgICAgLy8gdmFsaWQgYm1wIGNoYXIsIGJ1dCBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgfVxuXG4gICAgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcblxuICAgIC8vIGVuY29kZSB1dGY4XG4gICAgaWYgKGNvZGVQb2ludCA8IDB4ODApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMSkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChjb2RlUG9pbnQpXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDgwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2IHwgMHhDMCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyB8IDB4RTAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDQpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDEyIHwgMHhGMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb2RlIHBvaW50JylcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnl0ZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0ciwgdW5pdHMpIHtcbiAgdmFyIGMsIGhpLCBsb1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcblxuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KGJhc2U2NGNsZWFuKHN0cikpXG59XG5cbmZ1bmN0aW9uIGJsaXRCdWZmZXIgKHNyYywgZHN0LCBvZmZzZXQsIGxlbmd0aCkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgaWYgKChpICsgb2Zmc2V0ID49IGRzdC5sZW5ndGgpIHx8IChpID49IHNyYy5sZW5ndGgpKSBicmVha1xuICAgIGRzdFtpICsgb2Zmc2V0XSA9IHNyY1tpXVxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIGlzbmFuICh2YWwpIHtcbiAgcmV0dXJuIHZhbCAhPT0gdmFsIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tc2VsZi1jb21wYXJlXG59XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQXQgbGVhc3QgZ2l2ZSBzb21lIGtpbmQgb2YgY29udGV4dCB0byB0aGUgdXNlclxuICAgICAgICB2YXIgZXJyID0gbmV3IEVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LiAoJyArIGVyICsgJyknKTtcbiAgICAgICAgZXJyLmNvbnRleHQgPSBlcjtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2UgaWYgKGxpc3RlbmVycykge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgaWYgKHRoaXMuX2V2ZW50cykge1xuICAgIHZhciBldmxpc3RlbmVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oZXZsaXN0ZW5lcikpXG4gICAgICByZXR1cm4gMTtcbiAgICBlbHNlIGlmIChldmxpc3RlbmVyKVxuICAgICAgcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RoO1xuICB9XG4gIHJldHVybiAwO1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHJldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSk7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCJleHBvcnRzLnJlYWQgPSBmdW5jdGlvbiAoYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbVxuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIG5CaXRzID0gLTdcbiAgdmFyIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMFxuICB2YXIgZCA9IGlzTEUgPyAtMSA6IDFcbiAgdmFyIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV1cblxuICBpICs9IGRcblxuICBlID0gcyAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBzID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBlTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IGUgPSBlICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgZSA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gbUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gbSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhc1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSlcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pXG4gICAgZSA9IGUgLSBlQmlhc1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pXG59XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbiAoYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGNcbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMClcbiAgdmFyIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKVxuICB2YXIgZCA9IGlzTEUgPyAxIDogLTFcbiAgdmFyIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDBcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKVxuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwXG4gICAgZSA9IGVNYXhcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMilcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS1cbiAgICAgIGMgKj0gMlxuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gY1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcylcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKytcbiAgICAgIGMgLz0gMlxuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDBcbiAgICAgIGUgPSBlTWF4XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICh2YWx1ZSAqIGMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gZSArIGVCaWFzXG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IDBcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KSB7fVxuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG1cbiAgZUxlbiArPSBtTGVuXG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCkge31cblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjhcbn1cbiIsInZhciB0b1N0cmluZyA9IHt9LnRvU3RyaW5nO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKGFycikge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbChhcnIpID09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuIiwidmFyIHBhcnNlRGF0ZSA9IHJlcXVpcmUoJy4vcGFyc2VEYXRlJyksXG4gICAgZG9jID0gcmVxdWlyZSgnZG9jLWpzJyksXG4gICAgY3JlbCA9IHJlcXVpcmUoJ2NyZWwnKSxcbiAgICBkZWZhdWx0Q3NzID0gcmVxdWlyZSgnZGVmYXVsdGNzcycpO1xuXG5kZWZhdWx0Q3NzKCdkYXRlcGlja2VyLWNvbXBvbmVudCcsIGBcbiAgICAuZGF0ZXBpY2tlci1jb21wb25lbnR7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgICBmbGV4LWZsb3c6IHJvdyB3cmFwO1xuICAgICAgICBoZWlnaHQ6IDMycHg7XG4gICAgfVxuXG4gICAgLmRhdGVwaWNrZXItY29tcG9uZW50IGlucHV0e1xuICAgICAgICBoZWlnaHQ6IDMycHg7XG4gICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICBmbGV4OiAxO1xuICAgICAgICBwYWRkaW5nOiA1cHg7XG4gICAgfVxuXG4gICAgLmRhdGVwaWNrZXItY29tcG9uZW50IC5waWNrZXJ7XG4gICAgICAgIGZsZXg6IDAgMSAzMnB4O1xuICAgICAgICBoZWlnaHQ6IDMycHg7XG4gICAgICAgIHdpZHRoOiAzMnB4O1xuICAgICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgICAgIC13ZWJraXQtYXBwZWFyYW5jZTogbm9uZTtcbiAgICAgICAgLW1vei1hcHBlYXJhbmNlOiBub25lO1xuICAgICAgICAtbXMtYXBwZWFyYW5jZTogbm9uZTtcbiAgICAgICAgLW8tYXBwZWFyYW5jZTogbm9uZTtcbiAgICAgICAgLXdlYmtpdC1hcHBlYXJhbmNlOiBub25lO1xuICAgICAgICAtbW96LWFwcGVhcmFuY2U6IG5vbmU7XG4gICAgICAgIC1tcy1hcHBlYXJhbmNlOiBub25lO1xuICAgICAgICAtby1hcHBlYXJhbmNlOiBub25lO1xuICAgICAgICBhcHBlYXJhbmNlOiBub25lO1xuICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICBib3JkZXI6IHNvbGlkIDFweCBncmF5O1xuICAgIH1cblxuICAgIC5kYXRlcGlja2VyLWNvbXBvbmVudCA6Oi13ZWJraXQtZGF0ZXRpbWUtZWRpdC1kYXktZmllbGQsXG4gICAgLmRhdGVwaWNrZXItY29tcG9uZW50IDo6LXdlYmtpdC1kYXRldGltZS1lZGl0LW1vbnRoLWZpZWxkLFxuICAgIC5kYXRlcGlja2VyLWNvbXBvbmVudCA6Oi13ZWJraXQtZGF0ZXRpbWUtZWRpdC15ZWFyLWZpZWxkLFxuICAgIC5kYXRlcGlja2VyLWNvbXBvbmVudCA6Oi13ZWJraXQtZGF0ZXRpbWUtZWRpdC10ZXh0LFxuICAgIC5kYXRlcGlja2VyLWNvbXBvbmVudCA6Oi13ZWJraXQtaW5uZXItc3Bpbi1idXR0b25cbiAgICAge1xuICAgICAgICBjb2xvcjogdHJhbnNwYXJlbnQ7XG4gICAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICBmb250LXNpemU6IDFweDtcbiAgICB9XG5cbiAgICAuZGF0ZXBpY2tlci1jb21wb25lbnQgOjotd2Via2l0LWNhbGVuZGFyLXBpY2tlci1pbmRpY2F0b3J7XG4gICAgICAgIG9wYWNpdHk6IDE7XG4gICAgICAgIGNvbG9yOiBibGFjaztcbiAgICAgICAgZm9udC1zaXplOiAzMXB4O1xuICAgICAgICBwYWRkaW5nOiA1cHg7XG4gICAgICAgIG1hcmdpbjogMDtcbiAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICB0b3A6IDA7XG4gICAgICAgIGxlZnQ6MDtcbiAgICAgICAgcmlnaHQ6MDtcbiAgICAgICAgYm90dG9tOjA7XG4gICAgfVxuYCk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZmFzdG4sIGNvbXBvbmVudCwgdHlwZSwgc2V0dGluZ3MsIGNoaWxkcmVuKXtcbiAgICBzZXR0aW5ncy52YWx1ZSA9IHNldHRpbmdzLnZhbHVlO1xuXG4gICAgY29tcG9uZW50LmV4dGVuZCgnX2dlbmVyaWMnLCBzZXR0aW5ncywgY2hpbGRyZW4pO1xuICAgIGNvbXBvbmVudC5zZXRQcm9wZXJ0eSgnZGF0ZScpO1xuXG4gICAgY29tcG9uZW50LmdldEV2ZW50RWxlbWVudCA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHJldHVybiBjb21wb25lbnQudGV4dElucHV0O1xuICAgIH07XG5cbiAgICBjb21wb25lbnQuZ2V0UHJvcGVydHlFbGVtZW50ID0gZnVuY3Rpb24oa2V5KXtcbiAgICAgICAgaWYoa2V5ID09PSAnY2xhc3MnKXtcbiAgICAgICAgICAgIHJldHVybiBjb21wb25lbnQuZWxlbWVudDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjb21wb25lbnQudGV4dElucHV0ICYmIGNvbXBvbmVudC50ZXh0SW5wdXQuZWxlbWVudDtcbiAgICB9O1xuXG4gICAgY29tcG9uZW50LnJlbmRlciA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIGNvbXBvbmVudC50ZXh0SW5wdXQgPSBmYXN0bignaW5wdXQnLCB7XG4gICAgICAgICAgICB2YWx1ZTogJycsXG4gICAgICAgICAgICBwbGFjZWhvbGRlcjogc2V0dGluZ3MucGxhY2Vob2xkZXIsXG4gICAgICAgICAgICB0YWJpbmRleDogMCxcbiAgICAgICAgICAgIG9uY2hhbmdlOiAndmFsdWU6dmFsdWUnXG4gICAgICAgIH0pLnJlbmRlcigpO1xuXG4gICAgICAgIGNvbXBvbmVudC5kYXRlUGlja2VyID0gZmFzdG4oJ2lucHV0Jywge1xuICAgICAgICAgICAgdmFsdWU6IG51bGwsXG4gICAgICAgICAgICB0eXBlOiAnZGF0ZScsXG4gICAgICAgICAgICBjbGFzczogJ3BpY2tlcicsXG4gICAgICAgICAgICB0YWJpbmRleDogMCxcbiAgICAgICAgICAgIG9uY2hhbmdlOiAndmFsdWU6dmFsdWUnXG4gICAgICAgIH0pLnJlbmRlcigpO1xuXG4gICAgICAgIGNvbXBvbmVudC5lbGVtZW50ID0gY3JlbCgnc3BhbicsIHtjbGFzczogJ2RhdGVwaWNrZXItY29tcG9uZW50J30sXG4gICAgICAgICAgICBjb21wb25lbnQudGV4dElucHV0LmVsZW1lbnQsXG4gICAgICAgICAgICBjb21wb25lbnQuZGF0ZVBpY2tlci5lbGVtZW50XG4gICAgICAgICk7XG5cbiAgICAgICAgY29tcG9uZW50LmdldEV2ZW50RWxlbWVudCA9IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICByZXR1cm4gY29tcG9uZW50LmRhdGVQaWNrZXIuZWxlbWVudDtcbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbiB1cGRhdGVUYWJJbmRleCgpe1xuICAgICAgICAgICAgdmFyIHdpZHRoID0gd2luZG93LmlubmVyV2lkdGg7XG5cbiAgICAgICAgICAgIGNvbXBvbmVudC50ZXh0SW5wdXQudGFiaW5kZXgod2lkdGggPCA3NjggPyAnLTEnIDogJzAnKTtcbiAgICAgICAgICAgIGNvbXBvbmVudC5kYXRlUGlja2VyLnRhYmluZGV4KHdpZHRoIDwgNzY4ID8gJzAnIDogJy0xJyk7XG4gICAgICAgIH1cblxuICAgICAgICBkb2Mod2luZG93KS5vbigncmVzaXplJywgdXBkYXRlVGFiSW5kZXgpO1xuICAgICAgICB1cGRhdGVUYWJJbmRleCgpO1xuXG4gICAgICAgIGZ1bmN0aW9uIGZvY3VzaW4oZXZlbnQpe1xuICAgICAgICAgICAgZG9jKGNvbXBvbmVudC5lbGVtZW50KS5hZGRDbGFzcygnZm9jdXMnKTtcbiAgICAgICAgfVxuICAgICAgICBmdW5jdGlvbiBmb2N1c291dChldmVudCl7XG4gICAgICAgICAgICBkb2MoY29tcG9uZW50LmVsZW1lbnQpLnJlbW92ZUNsYXNzKCdmb2N1cycpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29tcG9uZW50LnRleHRJbnB1dC5lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2ZvY3VzJywgZm9jdXNpbik7XG4gICAgICAgIGNvbXBvbmVudC50ZXh0SW5wdXQuZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdibHVyJywgZm9jdXNvdXQpO1xuXG4gICAgICAgIGNvbXBvbmVudC5kYXRlUGlja2VyLmVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgY29tcG9uZW50LnRleHRJbnB1dC5lbGVtZW50LmZvY3VzKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbXBvbmVudC5kYXRlUGlja2VyLm9uKCdmb2N1cycsIGZ1bmN0aW9uKGV2ZW50KXtcbiAgICAgICAgICAgIGRvYyhjb21wb25lbnQuZWxlbWVudCkuYWRkQ2xhc3MoJ2ZvY3VzJyk7XG5cbiAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICB2YXIgb3BlblBpY2tlckV2ZW50ID0gbmV3IHdpbmRvdy5LZXlib2FyZEV2ZW50KCdrZXlkb3duJyk7XG4gICAgICAgICAgICAgICAgdmFyIG1ldGhvZCA9ICdpbml0S2V5Ym9hcmRFdmVudCcgaW4gb3BlblBpY2tlckV2ZW50ID8gJ2luaXRLZXlib2FyZEV2ZW50JyA6ICdpbml0S2V5RXZlbnQnO1xuICAgICAgICAgICAgICAgIG9wZW5QaWNrZXJFdmVudFttZXRob2RdKCdrZXlkb3duJywgdHJ1ZSwgdHJ1ZSwgd2luZG93LCAnRjQnLCAzLCB0cnVlLCBmYWxzZSwgdHJ1ZSwgZmFsc2UsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQuZGF0ZVBpY2tlci5lbGVtZW50LmRpc3BhdGNoRXZlbnQob3BlblBpY2tlckV2ZW50KTtcbiAgICAgICAgICAgIH0sIDApO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb21wb25lbnQuZGF0ZVBpY2tlci52YWx1ZS5vbignY2hhbmdlJywgZnVuY3Rpb24oZGF0ZSl7XG4gICAgICAgICAgICBjb21wb25lbnQuZGF0ZShkYXRlKTtcbiAgICAgICAgICAgIGNvbXBvbmVudC50ZXh0SW5wdXQuZWxlbWVudC5mb2N1cygpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb21wb25lbnQudGV4dElucHV0LnZhbHVlLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbih2YWx1ZSl7XG4gICAgICAgICAgICBjb21wb25lbnQuZGF0ZShwYXJzZURhdGUodmFsdWUpKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29tcG9uZW50LmRhdGUub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGRhdGUpe1xuICAgICAgICAgICAgZGF0ZSA9IGRhdGUgJiYgbmV3IERhdGUoZGF0ZSk7XG4gICAgICAgICAgICB2YXIgbm9EYXRlID0gIWRhdGUgfHwgaXNOYU4oZGF0ZSk7XG5cbiAgICAgICAgICAgIGNvbXBvbmVudC50ZXh0SW5wdXQudmFsdWUobm9EYXRlID8gJycgOiBkYXRlLnRvRGF0ZVN0cmluZygpKTtcbiAgICAgICAgICAgIGNvbXBvbmVudC5kYXRlUGlja2VyLnZhbHVlKG5vRGF0ZSA/IHVuZGVmaW5lZCA6IGRhdGUpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb21wb25lbnQuZW1pdCgncmVuZGVyJyk7XG5cbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbn07XG4iLCJ2YXIgY3JlYXRlRGF0ZVBpY2tlciA9IHJlcXVpcmUoJy4uLycpLFxuICAgIGNyZWwgPSByZXF1aXJlKCdjcmVsJyk7XG5cbndpbmRvdy5vbmxvYWQgPSBmdW5jdGlvbigpe1xuXG4gICAgLy8gQ3JlYXRlIGEgZGF0ZVBpY2tlci5cbiAgICB2YXIgZGF0ZVBpY2tlciA9IGNyZWF0ZURhdGVQaWNrZXIoe1xuICAgICAgICBwbGFjZWhvbGRlcjogJ0VudGVyIGEgZGF0ZSdcbiAgICB9KTtcblxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGF0ZVBpY2tlci5lbGVtZW50KTtcbn07IiwidmFyIGZhc3RuID0gcmVxdWlyZSgnZmFzdG4nKSh7XG4gICAgX2dlbmVyaWM6IHJlcXVpcmUoJ2Zhc3RuL2dlbmVyaWNDb21wb25lbnQnKSxcbiAgICB0ZXh0OiByZXF1aXJlKCdmYXN0bi90ZXh0Q29tcG9uZW50JyksXG4gICAgZGF0ZVBpY2tlcjogcmVxdWlyZSgnLi9kYXRlcGlja2VyQ29tcG9uZW50Jylcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHNldHRpbmdzKXtcbiAgICByZXR1cm4gZmFzdG4oJ2RhdGVQaWNrZXInLCBzZXR0aW5ncykuYXR0YWNoKCkucmVuZGVyKCk7XG59OyIsIi8vQ29weXJpZ2h0IChDKSAyMDEyIEtvcnkgTnVublxyXG5cclxuLy9QZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOlxyXG5cclxuLy9UaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cclxuXHJcbi8vVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXHJcblxyXG4vKlxyXG5cclxuICAgIFRoaXMgY29kZSBpcyBub3QgZm9ybWF0dGVkIGZvciByZWFkYWJpbGl0eSwgYnV0IHJhdGhlciBydW4tc3BlZWQgYW5kIHRvIGFzc2lzdCBjb21waWxlcnMuXHJcblxyXG4gICAgSG93ZXZlciwgdGhlIGNvZGUncyBpbnRlbnRpb24gc2hvdWxkIGJlIHRyYW5zcGFyZW50LlxyXG5cclxuICAgICoqKiBJRSBTVVBQT1JUICoqKlxyXG5cclxuICAgIElmIHlvdSByZXF1aXJlIHRoaXMgbGlicmFyeSB0byB3b3JrIGluIElFNywgYWRkIHRoZSBmb2xsb3dpbmcgYWZ0ZXIgZGVjbGFyaW5nIGNyZWwuXHJcblxyXG4gICAgdmFyIHRlc3REaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcclxuICAgICAgICB0ZXN0TGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsYWJlbCcpO1xyXG5cclxuICAgIHRlc3REaXYuc2V0QXR0cmlidXRlKCdjbGFzcycsICdhJyk7XHJcbiAgICB0ZXN0RGl2WydjbGFzc05hbWUnXSAhPT0gJ2EnID8gY3JlbC5hdHRyTWFwWydjbGFzcyddID0gJ2NsYXNzTmFtZSc6dW5kZWZpbmVkO1xyXG4gICAgdGVzdERpdi5zZXRBdHRyaWJ1dGUoJ25hbWUnLCdhJyk7XHJcbiAgICB0ZXN0RGl2WyduYW1lJ10gIT09ICdhJyA/IGNyZWwuYXR0ck1hcFsnbmFtZSddID0gZnVuY3Rpb24oZWxlbWVudCwgdmFsdWUpe1xyXG4gICAgICAgIGVsZW1lbnQuaWQgPSB2YWx1ZTtcclxuICAgIH06dW5kZWZpbmVkO1xyXG5cclxuXHJcbiAgICB0ZXN0TGFiZWwuc2V0QXR0cmlidXRlKCdmb3InLCAnYScpO1xyXG4gICAgdGVzdExhYmVsWydodG1sRm9yJ10gIT09ICdhJyA/IGNyZWwuYXR0ck1hcFsnZm9yJ10gPSAnaHRtbEZvcic6dW5kZWZpbmVkO1xyXG5cclxuXHJcblxyXG4qL1xyXG5cclxuKGZ1bmN0aW9uIChyb290LCBmYWN0b3J5KSB7XHJcbiAgICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCk7XHJcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xyXG4gICAgICAgIGRlZmluZShmYWN0b3J5KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcm9vdC5jcmVsID0gZmFjdG9yeSgpO1xyXG4gICAgfVxyXG59KHRoaXMsIGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBmbiA9ICdmdW5jdGlvbicsXHJcbiAgICAgICAgb2JqID0gJ29iamVjdCcsXHJcbiAgICAgICAgbm9kZVR5cGUgPSAnbm9kZVR5cGUnLFxyXG4gICAgICAgIHRleHRDb250ZW50ID0gJ3RleHRDb250ZW50JyxcclxuICAgICAgICBzZXRBdHRyaWJ1dGUgPSAnc2V0QXR0cmlidXRlJyxcclxuICAgICAgICBhdHRyTWFwU3RyaW5nID0gJ2F0dHJNYXAnLFxyXG4gICAgICAgIGlzTm9kZVN0cmluZyA9ICdpc05vZGUnLFxyXG4gICAgICAgIGlzRWxlbWVudFN0cmluZyA9ICdpc0VsZW1lbnQnLFxyXG4gICAgICAgIGQgPSB0eXBlb2YgZG9jdW1lbnQgPT09IG9iaiA/IGRvY3VtZW50IDoge30sXHJcbiAgICAgICAgaXNUeXBlID0gZnVuY3Rpb24oYSwgdHlwZSl7XHJcbiAgICAgICAgICAgIHJldHVybiB0eXBlb2YgYSA9PT0gdHlwZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGlzTm9kZSA9IHR5cGVvZiBOb2RlID09PSBmbiA/IGZ1bmN0aW9uIChvYmplY3QpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG9iamVjdCBpbnN0YW5jZW9mIE5vZGU7XHJcbiAgICAgICAgfSA6XHJcbiAgICAgICAgLy8gaW4gSUUgPD0gOCBOb2RlIGlzIGFuIG9iamVjdCwgb2J2aW91c2x5Li5cclxuICAgICAgICBmdW5jdGlvbihvYmplY3Qpe1xyXG4gICAgICAgICAgICByZXR1cm4gb2JqZWN0ICYmXHJcbiAgICAgICAgICAgICAgICBpc1R5cGUob2JqZWN0LCBvYmopICYmXHJcbiAgICAgICAgICAgICAgICAobm9kZVR5cGUgaW4gb2JqZWN0KSAmJlxyXG4gICAgICAgICAgICAgICAgaXNUeXBlKG9iamVjdC5vd25lckRvY3VtZW50LG9iaik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpc0VsZW1lbnQgPSBmdW5jdGlvbiAob2JqZWN0KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjcmVsW2lzTm9kZVN0cmluZ10ob2JqZWN0KSAmJiBvYmplY3Rbbm9kZVR5cGVdID09PSAxO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaXNBcnJheSA9IGZ1bmN0aW9uKGEpe1xyXG4gICAgICAgICAgICByZXR1cm4gYSBpbnN0YW5jZW9mIEFycmF5O1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXBwZW5kQ2hpbGQgPSBmdW5jdGlvbihlbGVtZW50LCBjaGlsZCkge1xyXG4gICAgICAgICAgaWYoIWNyZWxbaXNOb2RlU3RyaW5nXShjaGlsZCkpe1xyXG4gICAgICAgICAgICAgIGNoaWxkID0gZC5jcmVhdGVUZXh0Tm9kZShjaGlsZCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBlbGVtZW50LmFwcGVuZENoaWxkKGNoaWxkKTtcclxuICAgICAgICB9O1xyXG5cclxuXHJcbiAgICBmdW5jdGlvbiBjcmVsKCl7XHJcbiAgICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsIC8vTm90ZTogYXNzaWduZWQgdG8gYSB2YXJpYWJsZSB0byBhc3Npc3QgY29tcGlsZXJzLiBTYXZlcyBhYm91dCA0MCBieXRlcyBpbiBjbG9zdXJlIGNvbXBpbGVyLiBIYXMgbmVnbGlnYWJsZSBlZmZlY3Qgb24gcGVyZm9ybWFuY2UuXHJcbiAgICAgICAgICAgIGVsZW1lbnQgPSBhcmdzWzBdLFxyXG4gICAgICAgICAgICBjaGlsZCxcclxuICAgICAgICAgICAgc2V0dGluZ3MgPSBhcmdzWzFdLFxyXG4gICAgICAgICAgICBjaGlsZEluZGV4ID0gMixcclxuICAgICAgICAgICAgYXJndW1lbnRzTGVuZ3RoID0gYXJncy5sZW5ndGgsXHJcbiAgICAgICAgICAgIGF0dHJpYnV0ZU1hcCA9IGNyZWxbYXR0ck1hcFN0cmluZ107XHJcblxyXG4gICAgICAgIGVsZW1lbnQgPSBjcmVsW2lzRWxlbWVudFN0cmluZ10oZWxlbWVudCkgPyBlbGVtZW50IDogZC5jcmVhdGVFbGVtZW50KGVsZW1lbnQpO1xyXG4gICAgICAgIC8vIHNob3J0Y3V0XHJcbiAgICAgICAgaWYoYXJndW1lbnRzTGVuZ3RoID09PSAxKXtcclxuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZighaXNUeXBlKHNldHRpbmdzLG9iaikgfHwgY3JlbFtpc05vZGVTdHJpbmddKHNldHRpbmdzKSB8fCBpc0FycmF5KHNldHRpbmdzKSkge1xyXG4gICAgICAgICAgICAtLWNoaWxkSW5kZXg7XHJcbiAgICAgICAgICAgIHNldHRpbmdzID0gbnVsbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHNob3J0Y3V0IGlmIHRoZXJlIGlzIG9ubHkgb25lIGNoaWxkIHRoYXQgaXMgYSBzdHJpbmdcclxuICAgICAgICBpZigoYXJndW1lbnRzTGVuZ3RoIC0gY2hpbGRJbmRleCkgPT09IDEgJiYgaXNUeXBlKGFyZ3NbY2hpbGRJbmRleF0sICdzdHJpbmcnKSAmJiBlbGVtZW50W3RleHRDb250ZW50XSAhPT0gdW5kZWZpbmVkKXtcclxuICAgICAgICAgICAgZWxlbWVudFt0ZXh0Q29udGVudF0gPSBhcmdzW2NoaWxkSW5kZXhdO1xyXG4gICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICBmb3IoOyBjaGlsZEluZGV4IDwgYXJndW1lbnRzTGVuZ3RoOyArK2NoaWxkSW5kZXgpe1xyXG4gICAgICAgICAgICAgICAgY2hpbGQgPSBhcmdzW2NoaWxkSW5kZXhdO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmKGNoaWxkID09IG51bGwpe1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGlmIChpc0FycmF5KGNoaWxkKSkge1xyXG4gICAgICAgICAgICAgICAgICBmb3IgKHZhciBpPTA7IGkgPCBjaGlsZC5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGFwcGVuZENoaWxkKGVsZW1lbnQsIGNoaWxkW2ldKTtcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgYXBwZW5kQ2hpbGQoZWxlbWVudCwgY2hpbGQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmb3IodmFyIGtleSBpbiBzZXR0aW5ncyl7XHJcbiAgICAgICAgICAgIGlmKCFhdHRyaWJ1dGVNYXBba2V5XSl7XHJcbiAgICAgICAgICAgICAgICBlbGVtZW50W3NldEF0dHJpYnV0ZV0oa2V5LCBzZXR0aW5nc1trZXldKTtcclxuICAgICAgICAgICAgfWVsc2V7XHJcbiAgICAgICAgICAgICAgICB2YXIgYXR0ciA9IGF0dHJpYnV0ZU1hcFtrZXldO1xyXG4gICAgICAgICAgICAgICAgaWYodHlwZW9mIGF0dHIgPT09IGZuKXtcclxuICAgICAgICAgICAgICAgICAgICBhdHRyKGVsZW1lbnQsIHNldHRpbmdzW2tleV0pO1xyXG4gICAgICAgICAgICAgICAgfWVsc2V7XHJcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudFtzZXRBdHRyaWJ1dGVdKGF0dHIsIHNldHRpbmdzW2tleV0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gZWxlbWVudDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBVc2VkIGZvciBtYXBwaW5nIG9uZSBraW5kIG9mIGF0dHJpYnV0ZSB0byB0aGUgc3VwcG9ydGVkIHZlcnNpb24gb2YgdGhhdCBpbiBiYWQgYnJvd3NlcnMuXHJcbiAgICBjcmVsW2F0dHJNYXBTdHJpbmddID0ge307XHJcblxyXG4gICAgY3JlbFtpc0VsZW1lbnRTdHJpbmddID0gaXNFbGVtZW50O1xyXG5cclxuICAgIGNyZWxbaXNOb2RlU3RyaW5nXSA9IGlzTm9kZTtcclxuXHJcbiAgICByZXR1cm4gY3JlbDtcclxufSkpO1xyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHZhbCkge1xuICBpZiAodmFsID09PSBudWxsIHx8IHR5cGVvZiB2YWwgPT09ICdib29sZWFuJykge1xuICAgIHJldHVybiBudWxsXG4gIH1cbiAgdmFyIGQgPSBuZXcgRGF0ZSh2YWwpO1xuICByZXR1cm4gaXNOYU4oZC5nZXRUaW1lKCkpID8gbnVsbCA6IGQ7XG59O1xuIiwiLyoganNoaW50IG5vZGU6IHRydWUgKi9cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gICMgZGVmYXVsdGNzc1xuXG4gIEEgdmVyeSBzaW1wbGUgbW9kdWxlIGZvciBjcmVhdGluZyBhIGxpdHRsZSBiaXQgb2YgZGVmYXVsdGNzcy4gIFRoaXMgaXNcbiAgcmVhbGx5IHVzZWZ1bCBpZiB5b3UgYXJlIGNyZWF0aW5nIGEgc21hbGwgSlMgd2lkZ2V0IHRoYXQgeW91IHdhbnQgdG8gYmVcbiAgY29tcGxldGVseSBzdHlsYWJsZSBieSB0aGUgYXBwbGljYXRpb24gaW1wbGVtZW50ZXIgYnV0IHdvdWxkIGFsc28gbGlrZSBpdFxuICB0byBsb29rIFwia2luZCBvZiBva1wiIGlmIHNvbWVvbmUgd2FudCB0byBoYXZlIGEgcXVpY2sgcGxheS5cblxuICAjIyBIb3cgaXQgV29ya3NcblxuICBUaGUgcHJvdmlkZWQgY3NzIHRleHQgaXMgaW5qZWN0ZWQgaW50byB0aGUgSFRNTCBkb2N1bWVudCB3aXRoaW4gdGhlIGRvY3VtZW50XG4gIGA8aGVhZD5gIHByaW9yIHRvIGFueSBvdGhlciBgPGxpbms+YCBvciBgPHN0eWxlPmAgdGFncy4gIFRoaXMgZW5zdXJlcyB0aGF0XG4gIGFueSBkZWZpbml0aW9ucyB0aGF0IGFyZSBtYWRlIHdpdGhpbiB5b3VyIHByb3ZpZGVkIENTUyBoYXZlIGFtcGxlXG4gIG9wcG9ydHVuaXR5IHRvIGJlIG92ZXJyaWRkZW4gYnkgdXNlciBkZWZpbmVkIENTUy5cblxuICAjIyBFeGFtcGxlIFVzYWdlXG5cbiAgPDw8IGV4YW1wbGVzL3dpZGdldC5qc1xuXG4gICMjIFJlZmVyZW5jZVxuXG4gICMjIyBkZWZhdWx0Y3NzXG5cbiAgYGBgXG4gIGRlZmF1bHRjc3MobGFiZWwsIGNzc3RleHQpXG4gIGBgYFxuXG4gIENyZWF0ZSBhIG5ldyBkZWZhdWx0IGBzdHlsZWAgZWxlbWVudCBhbmQgdXNlIHRoZSBwcm92aWRlZCBgbGFiZWxgIHRvXG4gIGdlbmVyYXRlIGFuIGlkIGZvciB0aGUgZWxlbWVudCBcIiVsYWJlbCVfZGVmYXVsdHN0eWxlXCIuICBJZiBhbiBleGlzdGluZ1xuICBlbGVtZW50IHdpdGggdGhhdCBpZCBpcyBmb3VuZCwgdGhlbiBkbyBub3RoaW5nLlxuXG4gIElmIG5vdCwgdGhlbiBjcmVhdGUgdGhlIG5ldyBlbGVtZW50IGFuZCB1c2UgdGhlIHByb3ZpZGVkIGBjc3N0ZXh0YCBhc1xuICBgaW5uZXJUZXh0YCBmb3IgdGggZWxlbWVudC5cbioqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihsYWJlbCwgdGV4dCkge1xuICB2YXIgc3R5bGVJZCA9IGxhYmVsICsgJ19kZWZhdWx0c3R5bGUnO1xuXG4gIC8vIGxvb2sgZm9yIGEgRE9NIGVsZW1lbnQgd2l0aCB0aGUgc3R5bGUgaWRcbiAgdmFyIHN0eWxlRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChzdHlsZUlkKTtcblxuICAvLyBmaW5kIHRoZSBmaXJzdCA8bGluaz4gb3IgPHN0eWxlPiB0YWcgd2l0aGluIHRoZSBkb2N1bWVudCBoZWFkXG4gIHZhciBmaXJzdFN0eWxlRGVmID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbGlua1tyZWw9XCJzdHlsZXNoZWV0XCJdLHN0eWxlJyk7XG5cbiAgLy8gaWYgd2UgY2FuIGZpbmQgYSBET00gZWxlbWVudCB3aXRoIHRoYXQgaWQsIHRoZW4gZG8gbm90aGluZyBhcyBhIGRlZmF1bHRcbiAgLy8gc3R5bGUgaGFzIGFscmVhZHkgYmVlbiBhcHBsaWVkXG4gIGlmIChzdHlsZUVsKSB7XG4gICAgcmV0dXJuIHN0eWxlRWw7XG4gIH1cblxuICAvLyBvdGhlcndpc2UsIGNyZWF0ZSBhIHN0eWxlIGVsZW1lbnRcbiAgc3R5bGVFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gIHN0eWxlRWwuaW5uZXJIVE1MID0gdGV4dDtcblxuICAvLyBpbnNlcnQgdGhlIHN0eWxlIGVsZW1lbnQsIGluIG9yZGVyIG9yIHByZWZlcmVuY2VcbiAgLy8gMS4gYmVmb3JlIHRoZSBmaXJzdCBzdHlsZSByZWxhdGVkIGVsZW1lbnQgaW4gdGhlIHBhZ2VcbiAgaWYgKGZpcnN0U3R5bGVEZWYpIHtcbiAgICBmaXJzdFN0eWxlRGVmLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHN0eWxlRWwsIGZpcnN0U3R5bGVEZWYpO1xuICB9XG4gIC8vIDIuIHRvIHRoZSBlbmQgb2YgdGhlIEhFQURcbiAgZWxzZSBpZiAoZG9jdW1lbnQuaGVhZCkge1xuICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGVFbCk7XG4gIH1cbiAgLy8gMy4gYXMgdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIGJvZHlcbiAgZWxzZSBpZiAoZG9jdW1lbnQuYm9keSAmJiBkb2N1bWVudC5ib2R5LmNoaWxkTm9kZXMubGVuZ3RoID4gMCkge1xuICAgIGRvY3VtZW50LmJvZHkuaW5zZXJ0QmVmb3JlKHN0eWxlRWwsIGRvY3VtZW50LmJvZHkuY2hpbGROb2Rlc1swXSk7XG4gIH1cbiAgLy8gNC4gaW4gdGhlIGJvZHlcbiAgZWxzZSBpZiAoZG9jdW1lbnQuYm9keSkge1xuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoc3R5bGVFbCk7XG4gIH1cblxuICByZXR1cm4gc3R5bGVFbDtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBpc0xlYXBZZWFyID0gcmVxdWlyZSgnaXMtbGVhcC15ZWFyJyk7XG5cbnZhciBNT05USF9OQU1FUyA9IFtcImphbnVhcnlcIiwgXCJmZWJydWFyeVwiLCBcIm1hcmNoXCIsXG4gICAgICAgICAgICAgICAgICAgXCJhcHJpbFwiLCAgIFwibWF5XCIsICAgICAgXCJqdW5lXCIsXG4gICAgICAgICAgICAgICAgICAgXCJqdWx5XCIsICAgIFwiYXVndXN0XCIsICAgXCJzZXB0ZW1iZXJcIixcbiAgICAgICAgICAgICAgICAgICBcIm9jdG9iZXJcIiwgXCJub3ZlbWJlclwiLCBcImRlY2VtYmVyXCJdO1xuXG52YXIgREFZX05BTUVTID0gW1wic3VuZGF5XCIsIFwibW9uZGF5XCIsIFwidHVlc2RheVwiLCBcIndlZG5lc2RheVwiLCBcInRodXJzZGF5XCIsIFwiZnJpZGF5XCIsIFwic2F0dXJkYXlcIl07XG5cbnZhciBEQVlTX0lOX01PTlRIID0gW1xuICAzMSxcbiAgbnVsbCwgLy8gMjkgaW4gbGVhcCB5ZWFycywgb3RoZXJ3aXNlIDI4XG4gIDMxLFxuICAzMCxcbiAgMzEsXG4gIDMwLFxuICAzMSxcbiAgMzEsXG4gIDMwLFxuICAzMSxcbiAgMzAsXG4gIDMxXG5dO1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBwYXJzZShzdHIsIG9wdGlvbnMpIHtcbiAgaWYgKHR5cGVvZiBvcHRpb25zICE9PSAnb2JqZWN0Jykge1xuICAgIG9wdGlvbnMgPSB7dXNhOiBvcHRpb25zfTtcbiAgfVxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgb3B0aW9ucy51c2EgPSBvcHRpb25zLnVzYSAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy51c2EgOiBmYWxzZTtcbiAgb3B0aW9ucy5ub3cgPSBvcHRpb25zLm5vdyAhPT0gdW5kZWZpbmVkICA/IG9wdGlvbnMubm93IDogbmV3IERhdGUoKTtcbiAgb3B0aW9ucy5jdXRvZmYgPSBvcHRpb25zLmN1dG9mZiAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5jdXRvZmYgOiA4MDtcblxuICBzdHIgPSBzdHIudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG5cbiAgcmV0dXJuIHBhcnNlTmVhcmJ5RGF5cyhzdHIsIG9wdGlvbnMubm93KSB8fFxuICAgICAgICAgcGFyc2VMYXN0VGhpc05leHQoc3RyLCBvcHRpb25zLm5vdykgfHxcbiAgICAgICAgIHBhcnNlTnVtYmVyRGF0ZShzdHIsIG9wdGlvbnMudXNhKSB8fFxuICAgICAgICAgcGFyc2VOdW1iZXJEYXRlU2hvcnRZZWFyKHN0ciwgb3B0aW9ucy51c2EsIG9wdGlvbnMuY3V0b2ZmKSB8fFxuICAgICAgICAgcGFyc2VOdW1iZXJEYXRlTm9ZZWFyKHN0ciwgb3B0aW9ucy51c2EsIG9wdGlvbnMubm93KSB8fFxuICAgICAgICAgcGFyc2VXb3JkeURhdGUoc3RyLCBvcHRpb25zLm5vdywgb3B0aW9ucy5jdXRvZmYpIHx8XG4gICAgICAgICBwYXJzZUlzbzg2MDFEYXRlKHN0cik7XG59O1xuXG52YXIgTlVNQkVSICAgICAgICAgICAgICA9IC9eWzAtOV0rJC87XG52YXIgTlVNQkVSX1dJVEhfT1JESU5BTCA9IC9eKFswLTldKykoc3R8bmR8cmR8dGgpPyQvO1xudmFyIE5VTUJFUl9EQVRFICAgICAgICAgPSAvXigzWzAtMV18WzEtMl1bMC05XXwwP1sxLTldKVssXFx8XFxcXFxcL1xcLVxcLiBdKygxWzAtMl18MD9bMS05XSlbLFxcfFxcXFxcXC9cXC1cXC4gXSsoWzAtOV17NH0pJC87XG52YXIgTlVNQkVSX0RBVEVfVVNBICAgICA9IC9eKDFbMC0yXXwwP1sxLTldKVssXFx8XFxcXFxcL1xcLVxcLiBdKygzWzAtMV18WzEtMl1bMC05XXwwP1sxLTldKVssXFx8XFxcXFxcL1xcLVxcLiBdKyhbMC05XXs0fSkkLztcbnZhciBOVU1CRVJfREFURV9TSE9SVF9ZRUFSICAgICAgICAgPSAvXigzWzAtMV18WzEtMl1bMC05XXwwP1sxLTldKVssXFx8XFxcXFxcL1xcLVxcLiBdKygxWzAtMl18MD9bMS05XSlbLFxcfFxcXFxcXC9cXC1cXC4gXSsoWzAtOV17Mn0pJC87XG52YXIgTlVNQkVSX0RBVEVfU0hPUlRfWUVBUl9VU0EgICAgID0gL14oMVswLTJdfDA/WzEtOV0pWyxcXHxcXFxcXFwvXFwtXFwuIF0rKDNbMC0xXXxbMS0yXVswLTldfDA/WzEtOV0pWyxcXHxcXFxcXFwvXFwtXFwuIF0rKFswLTldezJ9KSQvO1xudmFyIE5VTUJFUl9EQVRFX05PX1lFQVIgICA9IC9eKDNbMC0xXXxbMS0yXVswLTldfDA/WzEtOV0pWyxcXHxcXFxcXFwvXFwtXFwuIF0rKDFbMC0yXXwwP1sxLTldKSQvO1xudmFyIE5VTUJFUl9EQVRFX05PX1lFQVJfVVNBICAgICA9IC9eKDFbMC0yXXwwP1sxLTldKVssXFx8XFxcXFxcL1xcLVxcLiBdKygzWzAtMV18WzEtMl1bMC05XXwwP1sxLTldKSQvO1xuXG5cbnZhciBJU09fODYwMV9EQVRFICAgICAgID0gL14oWzAtOV17NH0pLT8oMVswLTJdfDA/WzEtOV0pLT8oM1swLTFdfFsxLTJdWzAtOV18MD9bMS05XSkkLztcblxuZnVuY3Rpb24gYWRkRGF5cyhub3csIG51bWJlck9mRGF5cykge1xuICB2YXIgcmVzdWx0ID0gbmV3IERhdGUobm93ICogMSArIG51bWJlck9mRGF5cyAqIDYwICogNjAgKiAyNCAqIDEwMDApO1xuICByZXR1cm4gZGF0ZShyZXN1bHQuZ2V0RnVsbFllYXIoKSwgcmVzdWx0LmdldE1vbnRoKCksIHJlc3VsdC5nZXREYXRlKCkpO1xufVxuXG5cbmV4cG9ydHMucGFyc2VOZWFyYnlEYXlzID0gcGFyc2VOZWFyYnlEYXlzO1xuZnVuY3Rpb24gcGFyc2VOZWFyYnlEYXlzKHN0cmluZywgbm93KSB7XG4gIGlmIChzdHJpbmcgPT0gJ3RvZGF5Jykge1xuICAgIHJldHVybiBkYXRlKG5vdy5nZXRGdWxsWWVhcigpLCBub3cuZ2V0TW9udGgoKSwgbm93LmdldERhdGUoKSk7O1xuICB9IGVsc2UgaWYgKHN0cmluZyA9PSAneWVzdGVyZGF5Jykge1xuICAgIHJldHVybiBhZGREYXlzKG5vdywgLTEpO1xuICB9IGVsc2UgaWYgKHN0cmluZyA9PSAndG9tb3Jyb3cnKSB7XG4gICAgcmV0dXJuIGFkZERheXMobm93LCArMSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0cy5wYXJzZUxhc3RUaGlzTmV4dCA9IHBhcnNlTGFzdFRoaXNOZXh0O1xuZnVuY3Rpb24gcGFyc2VMYXN0VGhpc05leHQoc3RyaW5nLCBub3cpIHtcbiAgdmFyIHRva2VucyA9IHN0cmluZy5zcGxpdCgvWyxcXHNdKy8pO1xuXG4gIGlmIChbJ2xhc3QnLCAndGhpcycsICduZXh0J10uaW5kZXhPZih0b2tlbnNbMF0pID49IDAgJiZcbiAgICAgIERBWV9OQU1FUy5pbmRleE9mKHRva2Vuc1sxXSkgPj0gMCAmJlxuICAgICAgdG9rZW5zLmxlbmd0aCA9PT0gMikge1xuICAgIHZhciBkYXlEaWZmID0gREFZX05BTUVTLmluZGV4T2YodG9rZW5zWzFdKSAtIG5vdy5nZXREYXkoKTtcbiAgICBpZiAoZGF5RGlmZiA8IDApIGRheURpZmYgKz0gNztcblxuICAgIGlmICh0b2tlbnNbMF0gPT09ICdsYXN0JykgcmV0dXJuIGFkZERheXMobm93LCBkYXlEaWZmIC0gNyk7XG4gICAgaWYgKHRva2Vuc1swXSA9PT0gJ3RoaXMnKSByZXR1cm4gYWRkRGF5cyhub3csIGRheURpZmYpO1xuICAgIGlmICh0b2tlbnNbMF0gPT09ICduZXh0JykgcmV0dXJuIGFkZERheXMobm93LCBkYXlEaWZmICsgNyk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0cy5wYXJzZU51bWJlckRhdGUgPSBwYXJzZU51bWJlckRhdGU7XG5mdW5jdGlvbiBwYXJzZU51bWJlckRhdGUoc3RyLCB1c2EpIHtcbiAgdmFyIG1hdGNoID0gdXNhID8gTlVNQkVSX0RBVEVfVVNBLmV4ZWMoc3RyKSA6IE5VTUJFUl9EQVRFLmV4ZWMoc3RyKTtcbiAgaWYgKG1hdGNoKSB7XG4gICAgcmV0dXJuIHVzYSA/IGRhdGUoK21hdGNoWzNdLCBtYXRjaFsxXSAtIDEsICttYXRjaFsyXSkgOiBkYXRlKCttYXRjaFszXSwgbWF0Y2hbMl0gLSAxLCArbWF0Y2hbMV0pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydHMucGFyc2VOdW1iZXJEYXRlU2hvcnRZZWFyID0gcGFyc2VOdW1iZXJEYXRlU2hvcnRZZWFyO1xuZnVuY3Rpb24gcGFyc2VOdW1iZXJEYXRlU2hvcnRZZWFyKHN0ciwgdXNhLCBjdXRvZmYpIHtcbiAgdmFyIG1hdGNoID0gdXNhID8gTlVNQkVSX0RBVEVfU0hPUlRfWUVBUl9VU0EuZXhlYyhzdHIpIDogTlVNQkVSX0RBVEVfU0hPUlRfWUVBUi5leGVjKHN0cik7XG4gIGlmIChtYXRjaCkge1xuICAgIHZhciB5ZWFyID0gKCttYXRjaFszXSk7XG4gICAgaWYgKHllYXIgPiBjdXRvZmYpIHllYXIgKz0gMTkwMDtcbiAgICBlbHNlIHllYXIgKz0gMjAwMDtcbiAgICByZXR1cm4gdXNhID8gZGF0ZSh5ZWFyLCBtYXRjaFsxXSAtIDEsICttYXRjaFsyXSkgOiBkYXRlKHllYXIsIG1hdGNoWzJdIC0gMSwgK21hdGNoWzFdKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnRzLnBhcnNlTnVtYmVyRGF0ZU5vWWVhciA9IHBhcnNlTnVtYmVyRGF0ZU5vWWVhcjtcbmZ1bmN0aW9uIHBhcnNlTnVtYmVyRGF0ZU5vWWVhcihzdHIsIHVzYSwgdG9kYXkpIHtcbiAgdmFyIG1hdGNoID0gdXNhID8gTlVNQkVSX0RBVEVfTk9fWUVBUl9VU0EuZXhlYyhzdHIpIDogTlVNQkVSX0RBVEVfTk9fWUVBUi5leGVjKHN0cik7XG4gIGlmIChtYXRjaCkge1xuICAgIHZhciB5ZWFyID0gdG9kYXkuZ2V0RnVsbFllYXIoKTtcbiAgICByZXR1cm4gdXNhID8gZGF0ZSh5ZWFyLCBtYXRjaFsxXSAtIDEsICttYXRjaFsyXSkgOiBkYXRlKHllYXIsIG1hdGNoWzJdIC0gMSwgK21hdGNoWzFdKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnRzLnBhcnNlV29yZHlEYXRlID0gcGFyc2VXb3JkeURhdGU7XG5mdW5jdGlvbiBwYXJzZVdvcmR5RGF0ZShzdHJpbmcsIHRvZGF5LCBjdXRvZmYpIHtcbiAgdmFyIHRva2VucyA9IHN0cmluZy5zcGxpdCgvWyxcXHNdKy8pO1xuICBpZiAodG9rZW5zLmxlbmd0aCA+PSAyKSB7XG4gICAgdmFyIG1hdGNoO1xuICAgIGlmIChtYXRjaCA9IHRva2Vuc1swXS5tYXRjaChOVU1CRVJfV0lUSF9PUkRJTkFMKSkge1xuICAgICAgcmV0dXJuIHBhcnNlV29yZHlEYXRlUGFydHMobWF0Y2hbMV0sIHRva2Vuc1sxXSwgdG9rZW5zWzJdLCB0b2RheSwgY3V0b2ZmKTtcbiAgICB9IGVsc2UgaWYgKG1hdGNoID0gdG9rZW5zWzFdLm1hdGNoKE5VTUJFUl9XSVRIX09SRElOQUwpKSB7XG4gICAgICByZXR1cm4gcGFyc2VXb3JkeURhdGVQYXJ0cyhtYXRjaFsxXSwgdG9rZW5zWzBdLCB0b2tlbnNbMl0sIHRvZGF5LCBjdXRvZmYpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcGFyc2VXb3JkeURhdGVQYXJ0cyhyYXdEYXksIHJhd01vbnRoLCByYXdZZWFyLCB0b2RheSwgY3V0b2ZmKSB7XG4gIHZhciBkYXkgPSArcmF3RGF5O1xuICB2YXIgbW9udGggPSBtb250aEZyb21OYW1lKHJhd01vbnRoKTtcbiAgdmFyIHllYXI7XG5cbiAgaWYgKHJhd1llYXIpXG4gICAgeWVhciA9IHJhd1llYXIubWF0Y2goTlVNQkVSKSA/IHJhd1llYXIgKiAxIDogbnVsbDtcbiAgZWxzZVxuICAgIHllYXIgPSB0b2RheS5nZXRGdWxsWWVhcigpO1xuXG4gIGlmICh5ZWFyIDwgMTAwICYmIHllYXIgPj0gY3V0b2ZmKSB5ZWFyICs9IDE5MDA7XG4gIGlmICh5ZWFyIDwgMTAwKSB5ZWFyICs9IDIwMDA7XG5cbiAgaWYgKCEoZGF5ICYmIG1vbnRoICE9PSBudWxsICYmIHllYXIpKVxuICAgIHJldHVybiBudWxsO1xuXG4gIHJldHVybiBkYXRlKHllYXIsIG1vbnRoLCBkYXkpO1xufVxuXG5mdW5jdGlvbiBwYXJzZUlzbzg2MDFEYXRlKHN0cmluZykge1xuICB2YXIgbWF0Y2g7XG4gIGlmIChtYXRjaCA9IElTT184NjAxX0RBVEUuZXhlYyhzdHJpbmcpKSB7XG4gICAgcmV0dXJuIGRhdGUoK21hdGNoWzFdLCBtYXRjaFsyXSAtIDEsICttYXRjaFszXSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0cy5tb250aEZyb21OYW1lID0gbW9udGhGcm9tTmFtZTtcbmZ1bmN0aW9uIG1vbnRoRnJvbU5hbWUobW9udGgpIHtcbiAgdmFyIG1vbnRoQWJyZXZpYXRpb25zID0gTU9OVEhfTkFNRVMubWFwKGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBuYW1lLnN1YnN0cigwLCBtb250aC5sZW5ndGgpOyB9KTtcbiAgdmFyIG1vbnRoSW5kZXggPSBtb250aEFicmV2aWF0aW9ucy5pbmRleE9mKG1vbnRoKTtcbiAgaWYgKG1vbnRoSW5kZXggIT09IC0xICYmIG1vbnRoQWJyZXZpYXRpb25zLmluZGV4T2YobW9udGgsIG1vbnRoSW5kZXggKyAxKSA9PT0gLTEpIHtcbiAgICByZXR1cm4gbW9udGhJbmRleDtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZXhwb3J0cy5kYXRlID0gZGF0ZTtcbmZ1bmN0aW9uIGRhdGUoeWVhciwgbW9udGgsIGRheSkge1xuICBtb250aCsrO1xuICBpZiAobW9udGggPiAxMiB8fCBtb250aCA8IDEpIHJldHVybiBudWxsO1xuICBpZiAoZGF5IDwgMSkgcmV0dXJuIG51bGw7XG4gIGlmIChtb250aCA9PT0gMikge1xuICAgIGlmIChkYXkgPiAoaXNMZWFwWWVhcih5ZWFyKSA/IDI5IDogMjgpKSByZXR1cm4gbnVsbDtcbiAgfSBlbHNlIGlmIChkYXkgPiBEQVlTX0lOX01PTlRIW21vbnRoIC0gMV0pIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBpZiAobW9udGggPCAxMCkgbW9udGggPSAnMCcgKyBtb250aDtcbiAgaWYgKGRheSA8IDEwKSBkYXkgPSAnMCcgKyBkYXk7XG5cbiAgcmV0dXJuIHllYXIgKyAnLScgKyBtb250aCArICctJyArIGRheTtcbn1cbmZ1bmN0aW9uIGdldElTT1N0cmluZyh5ZWFyLCBtb250aCwgZGF5KSB7XG4gIG1vbnRoKys7XG4gIGlmIChtb250aCA8IDEwKSBtb250aCA9ICcwJyArIG1vbnRoO1xuICBpZiAoZGF5IDwgMTApIGRheSA9ICcwJyArIGRheTtcbiAgcmV0dXJuIHllYXIgKyAnLScgKyBtb250aCArICctJyArIGRheSArICdUMDA6MDA6MDAuMDAwWic7XG59XG4iLCJ2YXIgZG9jID0ge1xyXG4gICAgZG9jdW1lbnQ6IHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgPyBkb2N1bWVudCA6IG51bGwsXHJcbiAgICBzZXREb2N1bWVudDogZnVuY3Rpb24oZCl7XHJcbiAgICAgICAgdGhpcy5kb2N1bWVudCA9IGQ7XHJcbiAgICB9XHJcbn07XHJcblxyXG52YXIgYXJyYXlQcm90byA9IFtdLFxyXG4gICAgaXNMaXN0ID0gcmVxdWlyZSgnLi9pc0xpc3QnKSxcclxuICAgIGdldFRhcmdldHMgPSByZXF1aXJlKCcuL2dldFRhcmdldHMnKShkb2MuZG9jdW1lbnQpLFxyXG4gICAgZ2V0VGFyZ2V0ID0gcmVxdWlyZSgnLi9nZXRUYXJnZXQnKShkb2MuZG9jdW1lbnQpLFxyXG4gICAgc3BhY2UgPSAnICc7XHJcblxyXG5cclxuLy8vW1JFQURNRS5tZF1cclxuXHJcbmZ1bmN0aW9uIGlzSW4oYXJyYXksIGl0ZW0pe1xyXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgaWYoaXRlbSA9PT0gYXJyYXlbaV0pe1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG5cclxuICAgICMjIC5maW5kXHJcblxyXG4gICAgZmluZHMgZWxlbWVudHMgdGhhdCBtYXRjaCB0aGUgcXVlcnkgd2l0aGluIHRoZSBzY29wZSBvZiB0YXJnZXRcclxuXHJcbiAgICAgICAgLy9mbHVlbnRcclxuICAgICAgICBkb2ModGFyZ2V0KS5maW5kKHF1ZXJ5KTtcclxuXHJcbiAgICAgICAgLy9sZWdhY3lcclxuICAgICAgICBkb2MuZmluZCh0YXJnZXQsIHF1ZXJ5KTtcclxuKi9cclxuXHJcbmZ1bmN0aW9uIGZpbmQodGFyZ2V0LCBxdWVyeSl7XHJcbiAgICB0YXJnZXQgPSBnZXRUYXJnZXRzKHRhcmdldCk7XHJcbiAgICBpZihxdWVyeSA9PSBudWxsKXtcclxuICAgICAgICByZXR1cm4gdGFyZ2V0O1xyXG4gICAgfVxyXG5cclxuICAgIGlmKGlzTGlzdCh0YXJnZXQpKXtcclxuICAgICAgICB2YXIgcmVzdWx0cyA9IFtdO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGFyZ2V0Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciBzdWJSZXN1bHRzID0gZG9jLmZpbmQodGFyZ2V0W2ldLCBxdWVyeSk7XHJcbiAgICAgICAgICAgIGZvcih2YXIgaiA9IDA7IGogPCBzdWJSZXN1bHRzLmxlbmd0aDsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICBpZighaXNJbihyZXN1bHRzLCBzdWJSZXN1bHRzW2pdKSl7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHN1YlJlc3VsdHNbal0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiByZXN1bHRzO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB0YXJnZXQgPyB0YXJnZXQucXVlcnlTZWxlY3RvckFsbChxdWVyeSkgOiBbXTtcclxufVxyXG5cclxuLyoqXHJcblxyXG4gICAgIyMgLmZpbmRPbmVcclxuXHJcbiAgICBmaW5kcyB0aGUgZmlyc3QgZWxlbWVudCB0aGF0IG1hdGNoZXMgdGhlIHF1ZXJ5IHdpdGhpbiB0aGUgc2NvcGUgb2YgdGFyZ2V0XHJcblxyXG4gICAgICAgIC8vZmx1ZW50XHJcbiAgICAgICAgZG9jKHRhcmdldCkuZmluZE9uZShxdWVyeSk7XHJcblxyXG4gICAgICAgIC8vbGVnYWN5XHJcbiAgICAgICAgZG9jLmZpbmRPbmUodGFyZ2V0LCBxdWVyeSk7XHJcbiovXHJcblxyXG5mdW5jdGlvbiBmaW5kT25lKHRhcmdldCwgcXVlcnkpe1xyXG4gICAgdGFyZ2V0ID0gZ2V0VGFyZ2V0KHRhcmdldCk7XHJcbiAgICBpZihxdWVyeSA9PSBudWxsKXtcclxuICAgICAgICByZXR1cm4gdGFyZ2V0O1xyXG4gICAgfVxyXG5cclxuICAgIGlmKGlzTGlzdCh0YXJnZXQpKXtcclxuICAgICAgICB2YXIgcmVzdWx0O1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGFyZ2V0Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IGZpbmRPbmUodGFyZ2V0W2ldLCBxdWVyeSk7XHJcbiAgICAgICAgICAgIGlmKHJlc3VsdCl7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB0YXJnZXQgPyB0YXJnZXQucXVlcnlTZWxlY3RvcihxdWVyeSkgOiBudWxsO1xyXG59XHJcblxyXG4vKipcclxuXHJcbiAgICAjIyAuY2xvc2VzdFxyXG5cclxuICAgIHJlY3Vyc2VzIHVwIHRoZSBET00gZnJvbSB0aGUgdGFyZ2V0IG5vZGUsIGNoZWNraW5nIGlmIHRoZSBjdXJyZW50IGVsZW1lbnQgbWF0Y2hlcyB0aGUgcXVlcnlcclxuXHJcbiAgICAgICAgLy9mbHVlbnRcclxuICAgICAgICBkb2ModGFyZ2V0KS5jbG9zZXN0KHF1ZXJ5KTtcclxuXHJcbiAgICAgICAgLy9sZWdhY3lcclxuICAgICAgICBkb2MuY2xvc2VzdCh0YXJnZXQsIHF1ZXJ5KTtcclxuKi9cclxuXHJcbmZ1bmN0aW9uIGNsb3Nlc3QodGFyZ2V0LCBxdWVyeSl7XHJcbiAgICB0YXJnZXQgPSBnZXRUYXJnZXQodGFyZ2V0KTtcclxuXHJcbiAgICBpZihpc0xpc3QodGFyZ2V0KSl7XHJcbiAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0WzBdO1xyXG4gICAgfVxyXG5cclxuICAgIHdoaWxlKFxyXG4gICAgICAgIHRhcmdldCAmJlxyXG4gICAgICAgIHRhcmdldC5vd25lckRvY3VtZW50ICYmXHJcbiAgICAgICAgIWlzKHRhcmdldCwgcXVlcnkpXHJcbiAgICApe1xyXG4gICAgICAgIHRhcmdldCA9IHRhcmdldC5wYXJlbnROb2RlO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB0YXJnZXQgPT09IGRvYy5kb2N1bWVudCAmJiB0YXJnZXQgIT09IHF1ZXJ5ID8gbnVsbCA6IHRhcmdldDtcclxufVxyXG5cclxuLyoqXHJcblxyXG4gICAgIyMgLmlzXHJcblxyXG4gICAgcmV0dXJucyB0cnVlIGlmIHRoZSB0YXJnZXQgZWxlbWVudCBtYXRjaGVzIHRoZSBxdWVyeVxyXG5cclxuICAgICAgICAvL2ZsdWVudFxyXG4gICAgICAgIGRvYyh0YXJnZXQpLmlzKHF1ZXJ5KTtcclxuXHJcbiAgICAgICAgLy9sZWdhY3lcclxuICAgICAgICBkb2MuaXModGFyZ2V0LCBxdWVyeSk7XHJcbiovXHJcblxyXG5mdW5jdGlvbiBpcyh0YXJnZXQsIHF1ZXJ5KXtcclxuICAgIHRhcmdldCA9IGdldFRhcmdldCh0YXJnZXQpO1xyXG5cclxuICAgIGlmKGlzTGlzdCh0YXJnZXQpKXtcclxuICAgICAgICB0YXJnZXQgPSB0YXJnZXRbMF07XHJcbiAgICB9XHJcblxyXG4gICAgaWYoIXRhcmdldC5vd25lckRvY3VtZW50IHx8IHR5cGVvZiBxdWVyeSAhPT0gJ3N0cmluZycpe1xyXG4gICAgICAgIHJldHVybiB0YXJnZXQgPT09IHF1ZXJ5O1xyXG4gICAgfVxyXG5cclxuICAgIGlmKHRhcmdldCA9PT0gcXVlcnkpe1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBwYXJlbnRsZXNzID0gIXRhcmdldC5wYXJlbnROb2RlO1xyXG5cclxuICAgIGlmKHBhcmVudGxlc3Mpe1xyXG4gICAgICAgIC8vIEdpdmUgdGhlIGVsZW1lbnQgYSBwYXJlbnQgc28gdGhhdCAucXVlcnlTZWxlY3RvckFsbCBjYW4gYmUgdXNlZFxyXG4gICAgICAgIGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKS5hcHBlbmRDaGlsZCh0YXJnZXQpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciByZXN1bHQgPSBhcnJheVByb3RvLmluZGV4T2YuY2FsbChmaW5kKHRhcmdldC5wYXJlbnROb2RlLCBxdWVyeSksIHRhcmdldCkgPj0gMDtcclxuXHJcbiAgICBpZihwYXJlbnRsZXNzKXtcclxuICAgICAgICB0YXJnZXQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0YXJnZXQpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbi8qKlxyXG5cclxuICAgICMjIC5hZGRDbGFzc1xyXG5cclxuICAgIGFkZHMgY2xhc3NlcyB0byB0aGUgdGFyZ2V0IChzcGFjZSBzZXBhcmF0ZWQgc3RyaW5nIG9yIGFycmF5KVxyXG5cclxuICAgICAgICAvL2ZsdWVudFxyXG4gICAgICAgIGRvYyh0YXJnZXQpLmFkZENsYXNzKHF1ZXJ5KTtcclxuXHJcbiAgICAgICAgLy9sZWdhY3lcclxuICAgICAgICBkb2MuYWRkQ2xhc3ModGFyZ2V0LCBxdWVyeSk7XHJcbiovXHJcblxyXG5mdW5jdGlvbiBhZGRDbGFzcyh0YXJnZXQsIGNsYXNzZXMpe1xyXG4gICAgdGFyZ2V0ID0gZ2V0VGFyZ2V0cyh0YXJnZXQpO1xyXG5cclxuICAgIGlmKGlzTGlzdCh0YXJnZXQpKXtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRhcmdldC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBhZGRDbGFzcyh0YXJnZXRbaV0sIGNsYXNzZXMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuICAgIGlmKCFjbGFzc2VzKXtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICB2YXIgY2xhc3NlcyA9IEFycmF5LmlzQXJyYXkoY2xhc3NlcykgPyBjbGFzc2VzIDogY2xhc3Nlcy5zcGxpdChzcGFjZSksXHJcbiAgICAgICAgY3VycmVudENsYXNzZXMgPSB0YXJnZXQuY2xhc3NMaXN0ID8gbnVsbCA6IHRhcmdldC5jbGFzc05hbWUuc3BsaXQoc3BhY2UpO1xyXG5cclxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBjbGFzc2VzLmxlbmd0aDsgaSsrKXtcclxuICAgICAgICB2YXIgY2xhc3NUb0FkZCA9IGNsYXNzZXNbaV07XHJcbiAgICAgICAgaWYoIWNsYXNzVG9BZGQgfHwgY2xhc3NUb0FkZCA9PT0gc3BhY2Upe1xyXG4gICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYodGFyZ2V0LmNsYXNzTGlzdCl7XHJcbiAgICAgICAgICAgIHRhcmdldC5jbGFzc0xpc3QuYWRkKGNsYXNzVG9BZGQpO1xyXG4gICAgICAgIH0gZWxzZSBpZighY3VycmVudENsYXNzZXMuaW5kZXhPZihjbGFzc1RvQWRkKT49MCl7XHJcbiAgICAgICAgICAgIGN1cnJlbnRDbGFzc2VzLnB1c2goY2xhc3NUb0FkZCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYoIXRhcmdldC5jbGFzc0xpc3Qpe1xyXG4gICAgICAgIHRhcmdldC5jbGFzc05hbWUgPSBjdXJyZW50Q2xhc3Nlcy5qb2luKHNwYWNlKTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG59XHJcblxyXG4vKipcclxuXHJcbiAgICAjIyAucmVtb3ZlQ2xhc3NcclxuXHJcbiAgICByZW1vdmVzIGNsYXNzZXMgZnJvbSB0aGUgdGFyZ2V0IChzcGFjZSBzZXBhcmF0ZWQgc3RyaW5nIG9yIGFycmF5KVxyXG5cclxuICAgICAgICAvL2ZsdWVudFxyXG4gICAgICAgIGRvYyh0YXJnZXQpLnJlbW92ZUNsYXNzKHF1ZXJ5KTtcclxuXHJcbiAgICAgICAgLy9sZWdhY3lcclxuICAgICAgICBkb2MucmVtb3ZlQ2xhc3ModGFyZ2V0LCBxdWVyeSk7XHJcbiovXHJcblxyXG5mdW5jdGlvbiByZW1vdmVDbGFzcyh0YXJnZXQsIGNsYXNzZXMpe1xyXG4gICAgdGFyZ2V0ID0gZ2V0VGFyZ2V0cyh0YXJnZXQpO1xyXG5cclxuICAgIGlmKGlzTGlzdCh0YXJnZXQpKXtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRhcmdldC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICByZW1vdmVDbGFzcyh0YXJnZXRbaV0sIGNsYXNzZXMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBpZighY2xhc3Nlcyl7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGNsYXNzZXMgPSBBcnJheS5pc0FycmF5KGNsYXNzZXMpID8gY2xhc3NlcyA6IGNsYXNzZXMuc3BsaXQoc3BhY2UpLFxyXG4gICAgICAgIGN1cnJlbnRDbGFzc2VzID0gdGFyZ2V0LmNsYXNzTGlzdCA/IG51bGwgOiB0YXJnZXQuY2xhc3NOYW1lLnNwbGl0KHNwYWNlKTtcclxuXHJcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgY2xhc3Nlcy5sZW5ndGg7IGkrKyl7XHJcbiAgICAgICAgdmFyIGNsYXNzVG9SZW1vdmUgPSBjbGFzc2VzW2ldO1xyXG4gICAgICAgIGlmKCFjbGFzc1RvUmVtb3ZlIHx8IGNsYXNzVG9SZW1vdmUgPT09IHNwYWNlKXtcclxuICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmKHRhcmdldC5jbGFzc0xpc3Qpe1xyXG4gICAgICAgICAgICB0YXJnZXQuY2xhc3NMaXN0LnJlbW92ZShjbGFzc1RvUmVtb3ZlKTtcclxuICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciByZW1vdmVJbmRleCA9IGN1cnJlbnRDbGFzc2VzLmluZGV4T2YoY2xhc3NUb1JlbW92ZSk7XHJcbiAgICAgICAgaWYocmVtb3ZlSW5kZXggPj0gMCl7XHJcbiAgICAgICAgICAgIGN1cnJlbnRDbGFzc2VzLnNwbGljZShyZW1vdmVJbmRleCwgMSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYoIXRhcmdldC5jbGFzc0xpc3Qpe1xyXG4gICAgICAgIHRhcmdldC5jbGFzc05hbWUgPSBjdXJyZW50Q2xhc3Nlcy5qb2luKHNwYWNlKTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG59XHJcblxyXG5mdW5jdGlvbiBhZGRFdmVudChzZXR0aW5ncyl7XHJcbiAgICB2YXIgdGFyZ2V0ID0gZ2V0VGFyZ2V0KHNldHRpbmdzLnRhcmdldCk7XHJcbiAgICBpZih0YXJnZXQpe1xyXG4gICAgICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyKHNldHRpbmdzLmV2ZW50LCBzZXR0aW5ncy5jYWxsYmFjaywgZmFsc2UpO1xyXG4gICAgfWVsc2V7XHJcbiAgICAgICAgY29uc29sZS53YXJuKCdObyBlbGVtZW50cyBtYXRjaGVkIHRoZSBzZWxlY3Rvciwgc28gbm8gZXZlbnRzIHdlcmUgYm91bmQuJyk7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG5cclxuICAgICMjIC5vblxyXG5cclxuICAgIGJpbmRzIGEgY2FsbGJhY2sgdG8gYSB0YXJnZXQgd2hlbiBhIERPTSBldmVudCBpcyByYWlzZWQuXHJcblxyXG4gICAgICAgIC8vZmx1ZW50XHJcbiAgICAgICAgZG9jKHRhcmdldC9wcm94eSkub24oZXZlbnRzLCB0YXJnZXRbb3B0aW9uYWxdLCBjYWxsYmFjayk7XHJcblxyXG4gICAgbm90ZTogaWYgYSB0YXJnZXQgaXMgcGFzc2VkIHRvIHRoZSAub24gZnVuY3Rpb24sIGRvYydzIHRhcmdldCB3aWxsIGJlIHVzZWQgYXMgdGhlIHByb3h5LlxyXG5cclxuICAgICAgICAvL2xlZ2FjeVxyXG4gICAgICAgIGRvYy5vbihldmVudHMsIHRhcmdldCwgcXVlcnksIHByb3h5W29wdGlvbmFsXSk7XHJcbiovXHJcblxyXG5mdW5jdGlvbiBvbihldmVudHMsIHRhcmdldCwgY2FsbGJhY2ssIHByb3h5KXtcclxuXHJcbiAgICBwcm94eSA9IGdldFRhcmdldHMocHJveHkpO1xyXG5cclxuICAgIGlmKCFwcm94eSl7XHJcbiAgICAgICAgdGFyZ2V0ID0gZ2V0VGFyZ2V0cyh0YXJnZXQpO1xyXG4gICAgICAgIC8vIGhhbmRsZXMgbXVsdGlwbGUgdGFyZ2V0c1xyXG4gICAgICAgIGlmKGlzTGlzdCh0YXJnZXQpKXtcclxuICAgICAgICAgICAgdmFyIG11bHRpUmVtb3ZlQ2FsbGJhY2tzID0gW107XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGFyZ2V0Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBtdWx0aVJlbW92ZUNhbGxiYWNrcy5wdXNoKG9uKGV2ZW50cywgdGFyZ2V0W2ldLCBjYWxsYmFjaywgcHJveHkpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICAgIHdoaWxlKG11bHRpUmVtb3ZlQ2FsbGJhY2tzLmxlbmd0aCl7XHJcbiAgICAgICAgICAgICAgICAgICAgbXVsdGlSZW1vdmVDYWxsYmFja3MucG9wKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIGhhbmRsZXMgbXVsdGlwbGUgcHJveGllc1xyXG4gICAgLy8gQWxyZWFkeSBoYW5kbGVzIG11bHRpcGxlIHByb3hpZXMgYW5kIHRhcmdldHMsXHJcbiAgICAvLyBiZWNhdXNlIHRoZSB0YXJnZXQgbG9vcCBjYWxscyB0aGlzIGxvb3AuXHJcbiAgICBpZihpc0xpc3QocHJveHkpKXtcclxuICAgICAgICB2YXIgbXVsdGlSZW1vdmVDYWxsYmFja3MgPSBbXTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByb3h5Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIG11bHRpUmVtb3ZlQ2FsbGJhY2tzLnB1c2gob24oZXZlbnRzLCB0YXJnZXQsIGNhbGxiYWNrLCBwcm94eVtpXSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgd2hpbGUobXVsdGlSZW1vdmVDYWxsYmFja3MubGVuZ3RoKXtcclxuICAgICAgICAgICAgICAgIG11bHRpUmVtb3ZlQ2FsbGJhY2tzLnBvcCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcmVtb3ZlQ2FsbGJhY2tzID0gW107XHJcblxyXG4gICAgaWYodHlwZW9mIGV2ZW50cyA9PT0gJ3N0cmluZycpe1xyXG4gICAgICAgIGV2ZW50cyA9IGV2ZW50cy5zcGxpdChzcGFjZSk7XHJcbiAgICB9XHJcblxyXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGV2ZW50cy5sZW5ndGg7IGkrKyl7XHJcbiAgICAgICAgdmFyIGV2ZW50U2V0dGluZ3MgPSB7fTtcclxuICAgICAgICBpZihwcm94eSl7XHJcbiAgICAgICAgICAgIGlmKHByb3h5ID09PSB0cnVlKXtcclxuICAgICAgICAgICAgICAgIHByb3h5ID0gZG9jLmRvY3VtZW50O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGV2ZW50U2V0dGluZ3MudGFyZ2V0ID0gcHJveHk7XHJcbiAgICAgICAgICAgIGV2ZW50U2V0dGluZ3MuY2FsbGJhY2sgPSBmdW5jdGlvbihldmVudCl7XHJcbiAgICAgICAgICAgICAgICB2YXIgY2xvc2VzdFRhcmdldCA9IGNsb3Nlc3QoZXZlbnQudGFyZ2V0LCB0YXJnZXQpO1xyXG4gICAgICAgICAgICAgICAgaWYoY2xvc2VzdFRhcmdldCl7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXZlbnQsIGNsb3Nlc3RUYXJnZXQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICBldmVudFNldHRpbmdzLnRhcmdldCA9IHRhcmdldDtcclxuICAgICAgICAgICAgZXZlbnRTZXR0aW5ncy5jYWxsYmFjayA9IGNhbGxiYWNrO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZXZlbnRTZXR0aW5ncy5ldmVudCA9IGV2ZW50c1tpXTtcclxuXHJcbiAgICAgICAgYWRkRXZlbnQoZXZlbnRTZXR0aW5ncyk7XHJcblxyXG4gICAgICAgIHJlbW92ZUNhbGxiYWNrcy5wdXNoKGV2ZW50U2V0dGluZ3MpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBmdW5jdGlvbigpe1xyXG4gICAgICAgIHdoaWxlKHJlbW92ZUNhbGxiYWNrcy5sZW5ndGgpe1xyXG4gICAgICAgICAgICB2YXIgcmVtb3ZlQ2FsbGJhY2sgPSByZW1vdmVDYWxsYmFja3MucG9wKCk7XHJcbiAgICAgICAgICAgIGdldFRhcmdldChyZW1vdmVDYWxsYmFjay50YXJnZXQpLnJlbW92ZUV2ZW50TGlzdGVuZXIocmVtb3ZlQ2FsbGJhY2suZXZlbnQsIHJlbW92ZUNhbGxiYWNrLmNhbGxiYWNrKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG5cclxuICAgICMjIC5vZmZcclxuXHJcbiAgICByZW1vdmVzIGV2ZW50cyBhc3NpZ25lZCB0byBhIHRhcmdldC5cclxuXHJcbiAgICAgICAgLy9mbHVlbnRcclxuICAgICAgICBkb2ModGFyZ2V0L3Byb3h5KS5vZmYoZXZlbnRzLCB0YXJnZXRbb3B0aW9uYWxdLCBjYWxsYmFjayk7XHJcblxyXG4gICAgbm90ZTogaWYgYSB0YXJnZXQgaXMgcGFzc2VkIHRvIHRoZSAub24gZnVuY3Rpb24sIGRvYydzIHRhcmdldCB3aWxsIGJlIHVzZWQgYXMgdGhlIHByb3h5LlxyXG5cclxuICAgICAgICAvL2xlZ2FjeVxyXG4gICAgICAgIGRvYy5vZmYoZXZlbnRzLCB0YXJnZXQsIGNhbGxiYWNrLCBwcm94eSk7XHJcbiovXHJcblxyXG5mdW5jdGlvbiBvZmYoZXZlbnRzLCB0YXJnZXQsIGNhbGxiYWNrLCBwcm94eSl7XHJcbiAgICBpZihpc0xpc3QodGFyZ2V0KSl7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0YXJnZXQubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgb2ZmKGV2ZW50cywgdGFyZ2V0W2ldLCBjYWxsYmFjaywgcHJveHkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuICAgIGlmKHByb3h5IGluc3RhbmNlb2YgQXJyYXkpe1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJveHkubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgb2ZmKGV2ZW50cywgdGFyZ2V0LCBjYWxsYmFjaywgcHJveHlbaV0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBpZih0eXBlb2YgZXZlbnRzID09PSAnc3RyaW5nJyl7XHJcbiAgICAgICAgZXZlbnRzID0gZXZlbnRzLnNwbGl0KHNwYWNlKTtcclxuICAgIH1cclxuXHJcbiAgICBpZih0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpe1xyXG4gICAgICAgIHByb3h5ID0gY2FsbGJhY2s7XHJcbiAgICAgICAgY2FsbGJhY2sgPSBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIHByb3h5ID0gcHJveHkgPyBnZXRUYXJnZXQocHJveHkpIDogZG9jLmRvY3VtZW50O1xyXG5cclxuICAgIHZhciB0YXJnZXRzID0gdHlwZW9mIHRhcmdldCA9PT0gJ3N0cmluZycgPyBmaW5kKHRhcmdldCwgcHJveHkpIDogW3RhcmdldF07XHJcblxyXG4gICAgZm9yKHZhciB0YXJnZXRJbmRleCA9IDA7IHRhcmdldEluZGV4IDwgdGFyZ2V0cy5sZW5ndGg7IHRhcmdldEluZGV4Kyspe1xyXG4gICAgICAgIHZhciBjdXJyZW50VGFyZ2V0ID0gdGFyZ2V0c1t0YXJnZXRJbmRleF07XHJcblxyXG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBldmVudHMubGVuZ3RoOyBpKyspe1xyXG4gICAgICAgICAgICBjdXJyZW50VGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnRzW2ldLCBjYWxsYmFjayk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbn1cclxuXHJcbi8qKlxyXG5cclxuICAgICMjIC5hcHBlbmRcclxuXHJcbiAgICBhZGRzIGVsZW1lbnRzIHRvIGEgdGFyZ2V0XHJcblxyXG4gICAgICAgIC8vZmx1ZW50XHJcbiAgICAgICAgZG9jKHRhcmdldCkuYXBwZW5kKGNoaWxkcmVuKTtcclxuXHJcbiAgICAgICAgLy9sZWdhY3lcclxuICAgICAgICBkb2MuYXBwZW5kKHRhcmdldCwgY2hpbGRyZW4pO1xyXG4qL1xyXG5cclxuZnVuY3Rpb24gYXBwZW5kKHRhcmdldCwgY2hpbGRyZW4pe1xyXG4gICAgdmFyIHRhcmdldCA9IGdldFRhcmdldCh0YXJnZXQpLFxyXG4gICAgICAgIGNoaWxkcmVuID0gZ2V0VGFyZ2V0KGNoaWxkcmVuKTtcclxuXHJcbiAgICBpZihpc0xpc3QodGFyZ2V0KSl7XHJcbiAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0WzBdO1xyXG4gICAgfVxyXG5cclxuICAgIGlmKGlzTGlzdChjaGlsZHJlbikpe1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgYXBwZW5kKHRhcmdldCwgY2hpbGRyZW5baV0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdGFyZ2V0LmFwcGVuZENoaWxkKGNoaWxkcmVuKTtcclxufVxyXG5cclxuLyoqXHJcblxyXG4gICAgIyMgLnByZXBlbmRcclxuXHJcbiAgICBhZGRzIGVsZW1lbnRzIHRvIHRoZSBmcm9udCBvZiBhIHRhcmdldFxyXG5cclxuICAgICAgICAvL2ZsdWVudFxyXG4gICAgICAgIGRvYyh0YXJnZXQpLnByZXBlbmQoY2hpbGRyZW4pO1xyXG5cclxuICAgICAgICAvL2xlZ2FjeVxyXG4gICAgICAgIGRvYy5wcmVwZW5kKHRhcmdldCwgY2hpbGRyZW4pO1xyXG4qL1xyXG5cclxuZnVuY3Rpb24gcHJlcGVuZCh0YXJnZXQsIGNoaWxkcmVuKXtcclxuICAgIHZhciB0YXJnZXQgPSBnZXRUYXJnZXQodGFyZ2V0KSxcclxuICAgICAgICBjaGlsZHJlbiA9IGdldFRhcmdldChjaGlsZHJlbik7XHJcblxyXG4gICAgaWYoaXNMaXN0KHRhcmdldCkpe1xyXG4gICAgICAgIHRhcmdldCA9IHRhcmdldFswXTtcclxuICAgIH1cclxuXHJcbiAgICBpZihpc0xpc3QoY2hpbGRyZW4pKXtcclxuICAgICAgICAvL3JldmVyc2VkIGJlY2F1c2Ugb3RoZXJ3aXNlIHRoZSB3b3VsZCBnZXQgcHV0IGluIGluIHRoZSB3cm9uZyBvcmRlci5cclxuICAgICAgICBmb3IgKHZhciBpID0gY2hpbGRyZW4ubGVuZ3RoIC0xOyBpOyBpLS0pIHtcclxuICAgICAgICAgICAgcHJlcGVuZCh0YXJnZXQsIGNoaWxkcmVuW2ldKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRhcmdldC5pbnNlcnRCZWZvcmUoY2hpbGRyZW4sIHRhcmdldC5maXJzdENoaWxkKTtcclxufVxyXG5cclxuLyoqXHJcblxyXG4gICAgIyMgLmlzVmlzaWJsZVxyXG5cclxuICAgIGNoZWNrcyBpZiBhbiBlbGVtZW50IG9yIGFueSBvZiBpdHMgcGFyZW50cyBkaXNwbGF5IHByb3BlcnRpZXMgYXJlIHNldCB0byAnbm9uZSdcclxuXHJcbiAgICAgICAgLy9mbHVlbnRcclxuICAgICAgICBkb2ModGFyZ2V0KS5pc1Zpc2libGUoKTtcclxuXHJcbiAgICAgICAgLy9sZWdhY3lcclxuICAgICAgICBkb2MuaXNWaXNpYmxlKHRhcmdldCk7XHJcbiovXHJcblxyXG5mdW5jdGlvbiBpc1Zpc2libGUodGFyZ2V0KXtcclxuICAgIHZhciB0YXJnZXQgPSBnZXRUYXJnZXQodGFyZ2V0KTtcclxuICAgIGlmKCF0YXJnZXQpe1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGlmKGlzTGlzdCh0YXJnZXQpKXtcclxuICAgICAgICB2YXIgaSA9IC0xO1xyXG5cclxuICAgICAgICB3aGlsZSAodGFyZ2V0W2krK10gJiYgaXNWaXNpYmxlKHRhcmdldFtpXSkpIHt9XHJcbiAgICAgICAgcmV0dXJuIHRhcmdldC5sZW5ndGggPj0gaTtcclxuICAgIH1cclxuICAgIHdoaWxlKHRhcmdldC5wYXJlbnROb2RlICYmIHRhcmdldC5zdHlsZS5kaXNwbGF5ICE9PSAnbm9uZScpe1xyXG4gICAgICAgIHRhcmdldCA9IHRhcmdldC5wYXJlbnROb2RlO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB0YXJnZXQgPT09IGRvYy5kb2N1bWVudDtcclxufVxyXG5cclxuLyoqXHJcblxyXG4gICAgIyMgLmluZGV4T2ZFbGVtZW50XHJcblxyXG4gICAgcmV0dXJucyB0aGUgaW5kZXggb2YgdGhlIGVsZW1lbnQgd2l0aGluIGl0J3MgcGFyZW50IGVsZW1lbnQuXHJcblxyXG4gICAgICAgIC8vZmx1ZW50XHJcbiAgICAgICAgZG9jKHRhcmdldCkuaW5kZXhPZkVsZW1lbnQoKTtcclxuXHJcbiAgICAgICAgLy9sZWdhY3lcclxuICAgICAgICBkb2MuaW5kZXhPZkVsZW1lbnQodGFyZ2V0KTtcclxuXHJcbiovXHJcblxyXG5mdW5jdGlvbiBpbmRleE9mRWxlbWVudCh0YXJnZXQpIHtcclxuICAgIHRhcmdldCA9IGdldFRhcmdldHModGFyZ2V0KTtcclxuICAgIGlmKCF0YXJnZXQpe1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZihpc0xpc3QodGFyZ2V0KSl7XHJcbiAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0WzBdO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBpID0gLTE7XHJcblxyXG4gICAgdmFyIHBhcmVudCA9IHRhcmdldC5wYXJlbnRFbGVtZW50O1xyXG5cclxuICAgIGlmKCFwYXJlbnQpe1xyXG4gICAgICAgIHJldHVybiBpO1xyXG4gICAgfVxyXG5cclxuICAgIHdoaWxlKHBhcmVudC5jaGlsZHJlblsrK2ldICE9PSB0YXJnZXQpe31cclxuXHJcbiAgICByZXR1cm4gaTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG5cclxuICAgICMjIC5yZWFkeVxyXG5cclxuICAgIGNhbGwgYSBjYWxsYmFjayB3aGVuIHRoZSBkb2N1bWVudCBpcyByZWFkeS5cclxuXHJcbiAgICByZXR1cm5zIC0xIGlmIHRoZXJlIGlzIG5vIHBhcmVudEVsZW1lbnQgb24gdGhlIHRhcmdldC5cclxuXHJcbiAgICAgICAgLy9mbHVlbnRcclxuICAgICAgICBkb2MoKS5yZWFkeShjYWxsYmFjayk7XHJcblxyXG4gICAgICAgIC8vbGVnYWN5XHJcbiAgICAgICAgZG9jLnJlYWR5KGNhbGxiYWNrKTtcclxuKi9cclxuXHJcbmZ1bmN0aW9uIHJlYWR5KGNhbGxiYWNrKXtcclxuICAgIGlmKGRvYy5kb2N1bWVudCAmJiAoZG9jLmRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdjb21wbGV0ZScgfHwgZG9jLmRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdpbnRlcmFjdGl2ZScpKXtcclxuICAgICAgICBjYWxsYmFjaygpO1xyXG4gICAgfWVsc2UgaWYod2luZG93LmF0dGFjaEV2ZW50KXtcclxuICAgICAgICBkb2N1bWVudC5hdHRhY2hFdmVudChcIm9ucmVhZHlzdGF0ZWNoYW5nZVwiLCBjYWxsYmFjayk7XHJcbiAgICAgICAgd2luZG93LmF0dGFjaEV2ZW50KFwib25Mb2FkXCIsY2FsbGJhY2spO1xyXG4gICAgfWVsc2UgaWYoZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcil7XHJcbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIixjYWxsYmFjayxmYWxzZSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmRvYy5maW5kID0gZmluZDtcclxuZG9jLmZpbmRPbmUgPSBmaW5kT25lO1xyXG5kb2MuY2xvc2VzdCA9IGNsb3Nlc3Q7XHJcbmRvYy5pcyA9IGlzO1xyXG5kb2MuYWRkQ2xhc3MgPSBhZGRDbGFzcztcclxuZG9jLnJlbW92ZUNsYXNzID0gcmVtb3ZlQ2xhc3M7XHJcbmRvYy5vZmYgPSBvZmY7XHJcbmRvYy5vbiA9IG9uO1xyXG5kb2MuYXBwZW5kID0gYXBwZW5kO1xyXG5kb2MucHJlcGVuZCA9IHByZXBlbmQ7XHJcbmRvYy5pc1Zpc2libGUgPSBpc1Zpc2libGU7XHJcbmRvYy5yZWFkeSA9IHJlYWR5O1xyXG5kb2MuaW5kZXhPZkVsZW1lbnQgPSBpbmRleE9mRWxlbWVudDtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZG9jOyIsInZhciBkb2MgPSByZXF1aXJlKCcuL2RvYycpLFxyXG4gICAgaXNMaXN0ID0gcmVxdWlyZSgnLi9pc0xpc3QnKSxcclxuICAgIGdldFRhcmdldHMgPSByZXF1aXJlKCcuL2dldFRhcmdldHMnKShkb2MuZG9jdW1lbnQpLFxyXG4gICAgZmxvY1Byb3RvID0gW107XHJcblxyXG5mdW5jdGlvbiBGbG9jKGl0ZW1zKXtcclxuICAgIHRoaXMucHVzaC5hcHBseSh0aGlzLCBpdGVtcyk7XHJcbn1cclxuRmxvYy5wcm90b3R5cGUgPSBmbG9jUHJvdG87XHJcbmZsb2NQcm90by5jb25zdHJ1Y3RvciA9IEZsb2M7XHJcblxyXG5mdW5jdGlvbiBmbG9jKHRhcmdldCl7XHJcbiAgICB2YXIgaW5zdGFuY2UgPSBnZXRUYXJnZXRzKHRhcmdldCk7XHJcblxyXG4gICAgaWYoIWlzTGlzdChpbnN0YW5jZSkpe1xyXG4gICAgICAgIGlmKGluc3RhbmNlKXtcclxuICAgICAgICAgICAgaW5zdGFuY2UgPSBbaW5zdGFuY2VdO1xyXG4gICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICBpbnN0YW5jZSA9IFtdO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBuZXcgRmxvYyhpbnN0YW5jZSk7XHJcbn1cclxuXHJcbnZhciByZXR1cm5zU2VsZiA9ICdhZGRDbGFzcyByZW1vdmVDbGFzcyBhcHBlbmQgcHJlcGVuZCcuc3BsaXQoJyAnKTtcclxuXHJcbmZvcih2YXIga2V5IGluIGRvYyl7XHJcbiAgICBpZih0eXBlb2YgZG9jW2tleV0gPT09ICdmdW5jdGlvbicpe1xyXG4gICAgICAgIGZsb2Nba2V5XSA9IGRvY1trZXldO1xyXG4gICAgICAgIGZsb2NQcm90b1trZXldID0gKGZ1bmN0aW9uKGtleSl7XHJcbiAgICAgICAgICAgIHZhciBpbnN0YW5jZSA9IHRoaXM7XHJcbiAgICAgICAgICAgIC8vIFRoaXMgaXMgYWxzbyBleHRyZW1lbHkgZG9kZ3kgYW5kIGZhc3RcclxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGEsYixjLGQsZSxmKXtcclxuICAgICAgICAgICAgICAgIHZhciByZXN1bHQgPSBkb2Nba2V5XSh0aGlzLCBhLGIsYyxkLGUsZik7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYocmVzdWx0ICE9PSBkb2MgJiYgaXNMaXN0KHJlc3VsdCkpe1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmbG9jKHJlc3VsdCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZihyZXR1cm5zU2VsZi5pbmRleE9mKGtleSkgPj0wKXtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaW5zdGFuY2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0oa2V5KSk7XHJcbiAgICB9XHJcbn1cclxuZmxvY1Byb3RvLm9uID0gZnVuY3Rpb24oZXZlbnRzLCB0YXJnZXQsIGNhbGxiYWNrKXtcclxuICAgIHZhciBwcm94eSA9IHRoaXM7XHJcbiAgICBpZih0eXBlb2YgdGFyZ2V0ID09PSAnZnVuY3Rpb24nKXtcclxuICAgICAgICBjYWxsYmFjayA9IHRhcmdldDtcclxuICAgICAgICB0YXJnZXQgPSB0aGlzO1xyXG4gICAgICAgIHByb3h5ID0gbnVsbDtcclxuICAgIH1cclxuICAgIGRvYy5vbihldmVudHMsIHRhcmdldCwgY2FsbGJhY2ssIHByb3h5KTtcclxuICAgIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuZmxvY1Byb3RvLm9mZiA9IGZ1bmN0aW9uKGV2ZW50cywgdGFyZ2V0LCBjYWxsYmFjayl7XHJcbiAgICB2YXIgcmVmZXJlbmNlID0gdGhpcztcclxuICAgIGlmKHR5cGVvZiB0YXJnZXQgPT09ICdmdW5jdGlvbicpe1xyXG4gICAgICAgIGNhbGxiYWNrID0gdGFyZ2V0O1xyXG4gICAgICAgIHRhcmdldCA9IHRoaXM7XHJcbiAgICAgICAgcmVmZXJlbmNlID0gbnVsbDtcclxuICAgIH1cclxuICAgIGRvYy5vZmYoZXZlbnRzLCB0YXJnZXQsIGNhbGxiYWNrLCByZWZlcmVuY2UpO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG5mbG9jUHJvdG8ucmVhZHkgPSBmdW5jdGlvbihjYWxsYmFjayl7XHJcbiAgICBkb2MucmVhZHkoY2FsbGJhY2spO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG5mbG9jUHJvdG8uYWRkQ2xhc3MgPSBmdW5jdGlvbihjbGFzc05hbWUpe1xyXG4gICAgZG9jLmFkZENsYXNzKHRoaXMsIGNsYXNzTmFtZSk7XHJcbiAgICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcbmZsb2NQcm90by5yZW1vdmVDbGFzcyA9IGZ1bmN0aW9uKGNsYXNzTmFtZSl7XHJcbiAgICBkb2MucmVtb3ZlQ2xhc3ModGhpcywgY2xhc3NOYW1lKTtcclxuICAgIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmbG9jOyIsInZhciBzaW5nbGVJZCA9IC9eI1xcdyskLztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihkb2N1bWVudCl7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIGdldFRhcmdldCh0YXJnZXQpe1xuICAgICAgICBpZih0eXBlb2YgdGFyZ2V0ID09PSAnc3RyaW5nJyl7XG4gICAgICAgICAgICBpZihzaW5nbGVJZC5leGVjKHRhcmdldCkpe1xuICAgICAgICAgICAgICAgIHJldHVybiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCh0YXJnZXQuc2xpY2UoMSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IodGFyZ2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfTtcbn07IiwiXG52YXIgc2luZ2xlQ2xhc3MgPSAvXlxcLlxcdyskLyxcbiAgICBzaW5nbGVJZCA9IC9eI1xcdyskLyxcbiAgICBzaW5nbGVUYWcgPSAvXlxcdyskLztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihkb2N1bWVudCl7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIGdldFRhcmdldHModGFyZ2V0KXtcbiAgICAgICAgaWYodHlwZW9mIHRhcmdldCA9PT0gJ3N0cmluZycpe1xuICAgICAgICAgICAgaWYoc2luZ2xlSWQuZXhlYyh0YXJnZXQpKXtcbiAgICAgICAgICAgICAgICAvLyBJZiB5b3UgaGF2ZSBtb3JlIHRoYW4gMSBvZiB0aGUgc2FtZSBpZCBpbiB5b3VyIHBhZ2UsXG4gICAgICAgICAgICAgICAgLy8gdGhhdHMgeW91ciBvd24gc3R1cGlkIGZhdWx0LlxuICAgICAgICAgICAgICAgIHJldHVybiBbZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQodGFyZ2V0LnNsaWNlKDEpKV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZihzaW5nbGVUYWcuZXhlYyh0YXJnZXQpKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUodGFyZ2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmKHNpbmdsZUNsYXNzLmV4ZWModGFyZ2V0KSl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUodGFyZ2V0LnNsaWNlKDEpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKHRhcmdldCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgIH07XG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNMaXN0KG9iamVjdCl7XHJcbiAgICByZXR1cm4gb2JqZWN0ICE9IG51bGwgJiYgdHlwZW9mIG9iamVjdCA9PT0gJ29iamVjdCcgJiYgJ2xlbmd0aCcgaW4gb2JqZWN0ICYmICEoJ25vZGVUeXBlJyBpbiBvYmplY3QpICYmIG9iamVjdC5zZWxmICE9IG9iamVjdDsgLy8gaW4gSUU4LCB3aW5kb3cuc2VsZiBpcyB3aW5kb3csIGJ1dCBpdCBpcyBub3QgPT09IHdpbmRvdywgYnV0IGl0IGlzID09IHdpbmRvdy4uLi4uLi4uLiBXVEYhP1xyXG59IiwidmFyIGlzID0gcmVxdWlyZSgnLi9pcycpLFxuICAgIEdFTkVSSUMgPSAnX2dlbmVyaWMnLFxuICAgIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcixcbiAgICBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcblxuZnVuY3Rpb24gZmxhdHRlbihpdGVtKXtcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShpdGVtKSA/IGl0ZW0ucmVkdWNlKGZ1bmN0aW9uKHJlc3VsdCwgZWxlbWVudCl7XG4gICAgICAgIGlmKGVsZW1lbnQgPT0gbnVsbCl7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQuY29uY2F0KGZsYXR0ZW4oZWxlbWVudCkpO1xuICAgIH0sW10pIDogaXRlbTtcbn1cblxuZnVuY3Rpb24gYXR0YWNoUHJvcGVydGllcyhvYmplY3QsIGZpcm0pe1xuICAgIGZvcih2YXIga2V5IGluIHRoaXMuX3Byb3BlcnRpZXMpe1xuICAgICAgICB0aGlzLl9wcm9wZXJ0aWVzW2tleV0uYXR0YWNoKG9iamVjdCwgZmlybSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBvblJlbmRlcigpe1xuXG4gICAgLy8gRW5zdXJlIGFsbCBiaW5kaW5ncyBhcmUgc29tZXdoYXQgYXR0YWNoZWQganVzdCBiZWZvcmUgcmVuZGVyaW5nXG4gICAgdGhpcy5hdHRhY2godW5kZWZpbmVkLCAwKTtcblxuICAgIGZvcih2YXIga2V5IGluIHRoaXMuX3Byb3BlcnRpZXMpe1xuICAgICAgICB0aGlzLl9wcm9wZXJ0aWVzW2tleV0udXBkYXRlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkZXRhY2hQcm9wZXJ0aWVzKGZpcm0pe1xuICAgIGZvcih2YXIga2V5IGluIHRoaXMuX3Byb3BlcnRpZXMpe1xuICAgICAgICB0aGlzLl9wcm9wZXJ0aWVzW2tleV0uZGV0YWNoKGZpcm0pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZGVzdHJveVByb3BlcnRpZXMoKXtcbiAgICBmb3IodmFyIGtleSBpbiB0aGlzLl9wcm9wZXJ0aWVzKXtcbiAgICAgICAgdGhpcy5fcHJvcGVydGllc1trZXldLmRlc3Ryb3koKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGNsb25lKCl7XG4gICAgcmV0dXJuIHRoaXMuZmFzdG4odGhpcy5jb21wb25lbnQuX3R5cGUsIHRoaXMuY29tcG9uZW50Ll9zZXR0aW5ncywgdGhpcy5jb21wb25lbnQuX2NoaWxkcmVuLmZpbHRlcihmdW5jdGlvbihjaGlsZCl7XG4gICAgICAgICAgICByZXR1cm4gIWNoaWxkLl90ZW1wbGF0ZWQ7XG4gICAgICAgIH0pLm1hcChmdW5jdGlvbihjaGlsZCl7XG4gICAgICAgICAgICByZXR1cm4gY2hpbGQuY2xvbmUoKTtcbiAgICAgICAgfSlcbiAgICApO1xufVxuXG5mdW5jdGlvbiBnZXRTZXRCaW5kaW5nKG5ld0JpbmRpbmcpe1xuICAgIGlmKCFhcmd1bWVudHMubGVuZ3RoKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuYmluZGluZztcbiAgICB9XG5cbiAgICBpZighaXMuYmluZGluZyhuZXdCaW5kaW5nKSl7XG4gICAgICAgIG5ld0JpbmRpbmcgPSB0aGlzLmZhc3RuLmJpbmRpbmcobmV3QmluZGluZyk7XG4gICAgfVxuXG4gICAgaWYodGhpcy5iaW5kaW5nICYmIHRoaXMuYmluZGluZyAhPT0gbmV3QmluZGluZyl7XG4gICAgICAgIHRoaXMuYmluZGluZy5yZW1vdmVMaXN0ZW5lcignY2hhbmdlJywgdGhpcy5lbWl0QXR0YWNoKTtcbiAgICAgICAgbmV3QmluZGluZy5hdHRhY2godGhpcy5iaW5kaW5nLl9tb2RlbCwgdGhpcy5iaW5kaW5nLl9maXJtKTtcbiAgICB9XG5cbiAgICB0aGlzLmJpbmRpbmcgPSBuZXdCaW5kaW5nO1xuXG4gICAgdGhpcy5iaW5kaW5nLm9uKCdjaGFuZ2UnLCB0aGlzLmVtaXRBdHRhY2gpO1xuICAgIHRoaXMuYmluZGluZy5vbignZGV0YWNoJywgdGhpcy5lbWl0RGV0YWNoKTtcblxuICAgIHRoaXMuZW1pdEF0dGFjaCgpO1xuXG4gICAgcmV0dXJuIHRoaXMuY29tcG9uZW50O1xufTtcblxuZnVuY3Rpb24gZW1pdEF0dGFjaCgpe1xuICAgIHZhciBuZXdCb3VuZCA9IHRoaXMuYmluZGluZygpO1xuICAgIGlmKG5ld0JvdW5kICE9PSB0aGlzLmxhc3RCb3VuZCl7XG4gICAgICAgIHRoaXMubGFzdEJvdW5kID0gbmV3Qm91bmQ7XG4gICAgICAgIHRoaXMuc2NvcGUuYXR0YWNoKHRoaXMubGFzdEJvdW5kKTtcbiAgICAgICAgdGhpcy5jb21wb25lbnQuZW1pdCgnYXR0YWNoJywgdGhpcy5zY29wZSwgMSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBlbWl0RGV0YWNoKCl7XG4gICAgdGhpcy5jb21wb25lbnQuZW1pdCgnZGV0YWNoJywgMSk7XG59XG5cbmZ1bmN0aW9uIGdldFNjb3BlKCl7XG4gICAgcmV0dXJuIHRoaXMuc2NvcGU7XG59XG5cbmZ1bmN0aW9uIGRlc3Ryb3koKXtcbiAgICBpZih0aGlzLmRlc3Ryb3llZCl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5kZXN0cm95ZWQgPSB0cnVlO1xuXG4gICAgdGhpcy5jb21wb25lbnRcbiAgICAgICAgLnJlbW92ZUFsbExpc3RlbmVycygncmVuZGVyJylcbiAgICAgICAgLnJlbW92ZUFsbExpc3RlbmVycygnYXR0YWNoJyk7XG5cbiAgICB0aGlzLmNvbXBvbmVudC5lbWl0KCdkZXN0cm95Jyk7XG4gICAgdGhpcy5jb21wb25lbnQuZWxlbWVudCA9IG51bGw7XG4gICAgdGhpcy5zY29wZS5kZXN0cm95KCk7XG4gICAgdGhpcy5iaW5kaW5nLmRlc3Ryb3koKTtcblxuICAgIHJldHVybiB0aGlzLmNvbXBvbmVudDtcbn1cblxuZnVuY3Rpb24gYXR0YWNoQ29tcG9uZW50KG9iamVjdCwgZmlybSl7XG4gICAgdGhpcy5iaW5kaW5nLmF0dGFjaChvYmplY3QsIGZpcm0pO1xuICAgIHJldHVybiB0aGlzLmNvbXBvbmVudDtcbn1cblxuZnVuY3Rpb24gZGV0YWNoQ29tcG9uZW50KGZpcm0pe1xuICAgIHRoaXMuYmluZGluZy5kZXRhY2goZmlybSk7XG4gICAgcmV0dXJuIHRoaXMuY29tcG9uZW50O1xufVxuXG5mdW5jdGlvbiBpc0Rlc3Ryb3llZCgpe1xuICAgIHJldHVybiB0aGlzLmRlc3Ryb3llZDtcbn1cblxuZnVuY3Rpb24gc2V0UHJvcGVydHkoa2V5LCBwcm9wZXJ0eSl7XG5cbiAgICAvLyBBZGQgYSBkZWZhdWx0IHByb3BlcnR5IG9yIHVzZSB0aGUgb25lIGFscmVhZHkgdGhlcmVcbiAgICBpZighcHJvcGVydHkpe1xuICAgICAgICBwcm9wZXJ0eSA9IHRoaXMuY29tcG9uZW50W2tleV0gfHwgdGhpcy5mYXN0bi5wcm9wZXJ0eSgpO1xuICAgIH1cblxuICAgIHRoaXMuY29tcG9uZW50W2tleV0gPSBwcm9wZXJ0eTtcbiAgICB0aGlzLmNvbXBvbmVudC5fcHJvcGVydGllc1trZXldID0gcHJvcGVydHk7XG5cbiAgICByZXR1cm4gdGhpcy5jb21wb25lbnQ7XG59XG5cbmZ1bmN0aW9uIGV4dGVuZENvbXBvbmVudCh0eXBlLCBzZXR0aW5ncywgY2hpbGRyZW4pe1xuXG4gICAgaWYodHlwZSBpbiB0aGlzLnR5cGVzKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29tcG9uZW50O1xuICAgIH1cblxuICAgIGlmKCEodHlwZSBpbiB0aGlzLmZhc3RuLmNvbXBvbmVudHMpKXtcblxuICAgICAgICBpZighKEdFTkVSSUMgaW4gdGhpcy5mYXN0bi5jb21wb25lbnRzKSl7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIGNvbXBvbmVudCBvZiB0eXBlIFwiJyArIHR5cGUgKyAnXCIgaXMgbG9hZGVkJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZhc3RuLmNvbXBvbmVudHMuX2dlbmVyaWModGhpcy5mYXN0biwgdGhpcy5jb21wb25lbnQsIHR5cGUsIHNldHRpbmdzLCBjaGlsZHJlbik7XG5cbiAgICAgICAgdGhpcy50eXBlcy5fZ2VuZXJpYyA9IHRydWU7XG4gICAgfWVsc2V7XG5cbiAgICAgICAgdGhpcy5mYXN0bi5jb21wb25lbnRzW3R5cGVdKHRoaXMuZmFzdG4sIHRoaXMuY29tcG9uZW50LCB0eXBlLCBzZXR0aW5ncywgY2hpbGRyZW4pO1xuICAgIH1cblxuICAgIHRoaXMudHlwZXNbdHlwZV0gPSB0cnVlO1xuXG4gICAgcmV0dXJuIHRoaXMuY29tcG9uZW50O1xufTtcblxuZnVuY3Rpb24gaXNUeXBlKHR5cGUpe1xuICAgIHJldHVybiB0eXBlIGluIHRoaXMudHlwZXM7XG59XG5cbmZ1bmN0aW9uIEZhc3RuQ29tcG9uZW50KGZhc3RuLCB0eXBlLCBzZXR0aW5ncywgY2hpbGRyZW4pe1xuICAgIHZhciBjb21wb25lbnQgPSB0aGlzO1xuXG4gICAgdmFyIGNvbXBvbmVudFNjb3BlID0ge1xuICAgICAgICB0eXBlczoge30sXG4gICAgICAgIGZhc3RuOiBmYXN0bixcbiAgICAgICAgY29tcG9uZW50OiBjb21wb25lbnQsXG4gICAgICAgIGJpbmRpbmc6IGZhc3RuLmJpbmRpbmcoJy4nKSxcbiAgICAgICAgZGVzdHJveWVkOiBmYWxzZSxcbiAgICAgICAgc2NvcGU6IG5ldyBmYXN0bi5Nb2RlbChmYWxzZSksXG4gICAgICAgIGxhc3RCb3VuZDogbnVsbFxuICAgIH07XG5cbiAgICBjb21wb25lbnRTY29wZS5lbWl0QXR0YWNoID0gZW1pdEF0dGFjaC5iaW5kKGNvbXBvbmVudFNjb3BlKTtcbiAgICBjb21wb25lbnRTY29wZS5lbWl0RGV0YWNoID0gZW1pdERldGFjaC5iaW5kKGNvbXBvbmVudFNjb3BlKTtcbiAgICBjb21wb25lbnRTY29wZS5iaW5kaW5nLl9kZWZhdWx0X2JpbmRpbmcgPSB0cnVlO1xuXG4gICAgY29tcG9uZW50Ll90eXBlID0gdHlwZTtcbiAgICBjb21wb25lbnQuX3Byb3BlcnRpZXMgPSB7fTtcbiAgICBjb21wb25lbnQuX3NldHRpbmdzID0gc2V0dGluZ3MgfHwge307XG4gICAgY29tcG9uZW50Ll9jaGlsZHJlbiA9IGNoaWxkcmVuID8gZmxhdHRlbihjaGlsZHJlbikgOiBbXTtcblxuICAgIGNvbXBvbmVudC5hdHRhY2ggPSBhdHRhY2hDb21wb25lbnQuYmluZChjb21wb25lbnRTY29wZSk7XG4gICAgY29tcG9uZW50LmRldGFjaCA9IGRldGFjaENvbXBvbmVudC5iaW5kKGNvbXBvbmVudFNjb3BlKTtcbiAgICBjb21wb25lbnQuc2NvcGUgPSBnZXRTY29wZS5iaW5kKGNvbXBvbmVudFNjb3BlKTtcbiAgICBjb21wb25lbnQuZGVzdHJveSA9IGRlc3Ryb3kuYmluZChjb21wb25lbnRTY29wZSk7XG4gICAgY29tcG9uZW50LmRlc3Ryb3llZCA9IGlzRGVzdHJveWVkLmJpbmQoY29tcG9uZW50U2NvcGUpO1xuICAgIGNvbXBvbmVudC5iaW5kaW5nID0gZ2V0U2V0QmluZGluZy5iaW5kKGNvbXBvbmVudFNjb3BlKTtcbiAgICBjb21wb25lbnQuc2V0UHJvcGVydHkgPSBzZXRQcm9wZXJ0eS5iaW5kKGNvbXBvbmVudFNjb3BlKTtcbiAgICBjb21wb25lbnQuY2xvbmUgPSBjbG9uZS5iaW5kKGNvbXBvbmVudFNjb3BlKTtcbiAgICBjb21wb25lbnQuY2hpbGRyZW4gPSBzbGljZS5iaW5kKGNvbXBvbmVudC5fY2hpbGRyZW4pO1xuICAgIGNvbXBvbmVudC5leHRlbmQgPSBleHRlbmRDb21wb25lbnQuYmluZChjb21wb25lbnRTY29wZSk7XG4gICAgY29tcG9uZW50LmlzID0gaXNUeXBlLmJpbmQoY29tcG9uZW50U2NvcGUpO1xuXG4gICAgY29tcG9uZW50LmJpbmRpbmcoY29tcG9uZW50U2NvcGUuYmluZGluZyk7XG5cbiAgICBjb21wb25lbnQub24oJ2F0dGFjaCcsIGF0dGFjaFByb3BlcnRpZXMuYmluZCh0aGlzKSk7XG4gICAgY29tcG9uZW50Lm9uKCdyZW5kZXInLCBvblJlbmRlci5iaW5kKHRoaXMpKTtcbiAgICBjb21wb25lbnQub24oJ2RldGFjaCcsIGRldGFjaFByb3BlcnRpZXMuYmluZCh0aGlzKSk7XG4gICAgY29tcG9uZW50Lm9uKCdkZXN0cm95JywgZGVzdHJveVByb3BlcnRpZXMuYmluZCh0aGlzKSk7XG5cbiAgICBpZihmYXN0bi5kZWJ1Zyl7XG4gICAgICAgIGNvbXBvbmVudC5vbigncmVuZGVyJywgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIGlmKGNvbXBvbmVudC5lbGVtZW50ICYmIHR5cGVvZiBjb21wb25lbnQuZWxlbWVudCA9PT0gJ29iamVjdCcpe1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC5lbGVtZW50Ll9jb21wb25lbnQgPSBjb21wb25lbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbn1cbkZhc3RuQ29tcG9uZW50LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5GYXN0bkNvbXBvbmVudC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBGYXN0bkNvbXBvbmVudDtcbkZhc3RuQ29tcG9uZW50LnByb3RvdHlwZS5fZmFzdG5fY29tcG9uZW50ID0gdHJ1ZTtcblxubW9kdWxlLmV4cG9ydHMgPSBGYXN0bkNvbXBvbmVudDsiLCJ2YXIgRW50aSA9IHJlcXVpcmUoJ2VudGknKSxcbiAgICBpcyA9IHJlcXVpcmUoJy4vaXMnKSxcbiAgICBmaXJtZXIgPSByZXF1aXJlKCcuL2Zpcm1lcicpLFxuICAgIGZ1bmN0aW9uRW1pdHRlciA9IHJlcXVpcmUoJy4vZnVuY3Rpb25FbWl0dGVyJyksXG4gICAgc2V0UHJvdG90eXBlT2YgPSByZXF1aXJlKCdzZXRwcm90b3R5cGVvZicpLFxuICAgIHNhbWUgPSByZXF1aXJlKCdzYW1lLXZhbHVlJyk7XG5cbmZ1bmN0aW9uIGZ1c2VCaW5kaW5nKCl7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgdmFyIGJpbmRpbmdzID0gYXJncy5zbGljZSgpLFxuICAgICAgICB0cmFuc2Zvcm0gPSBiaW5kaW5ncy5wb3AoKSxcbiAgICAgICAgdXBkYXRlVHJhbnNmb3JtLFxuICAgICAgICByZXN1bHRCaW5kaW5nID0gY3JlYXRlQmluZGluZygncmVzdWx0JyksXG4gICAgICAgIHNlbGZDaGFuZ2luZztcblxuICAgIHJlc3VsdEJpbmRpbmcuX2FyZ3VtZW50cyA9IGFyZ3M7XG5cbiAgICBpZih0eXBlb2YgYmluZGluZ3NbYmluZGluZ3MubGVuZ3RoLTFdID09PSAnZnVuY3Rpb24nICYmICFpcy5iaW5kaW5nKGJpbmRpbmdzW2JpbmRpbmdzLmxlbmd0aC0xXSkpe1xuICAgICAgICB1cGRhdGVUcmFuc2Zvcm0gPSB0cmFuc2Zvcm07XG4gICAgICAgIHRyYW5zZm9ybSA9IGJpbmRpbmdzLnBvcCgpO1xuICAgIH1cblxuICAgIHJlc3VsdEJpbmRpbmcuX21vZGVsLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgIHJlc3VsdEJpbmRpbmcuX3NldCA9IGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAgICAgaWYodXBkYXRlVHJhbnNmb3JtKXtcbiAgICAgICAgICAgIHNlbGZDaGFuZ2luZyA9IHRydWU7XG4gICAgICAgICAgICB2YXIgbmV3VmFsdWUgPSB1cGRhdGVUcmFuc2Zvcm0odmFsdWUpO1xuICAgICAgICAgICAgaWYoIXNhbWUobmV3VmFsdWUsIGJpbmRpbmdzWzBdKCkpKXtcbiAgICAgICAgICAgICAgICBiaW5kaW5nc1swXShuZXdWYWx1ZSk7XG4gICAgICAgICAgICAgICAgcmVzdWx0QmluZGluZy5fY2hhbmdlKG5ld1ZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNlbGZDaGFuZ2luZyA9IGZhbHNlO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHJlc3VsdEJpbmRpbmcuX2NoYW5nZSh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gY2hhbmdlKCl7XG4gICAgICAgIGlmKHNlbGZDaGFuZ2luZyl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0QmluZGluZyh0cmFuc2Zvcm0uYXBwbHkobnVsbCwgYmluZGluZ3MubWFwKGZ1bmN0aW9uKGJpbmRpbmcpe1xuICAgICAgICAgICAgcmV0dXJuIGJpbmRpbmcoKTtcbiAgICAgICAgfSkpKTtcbiAgICB9XG5cbiAgICBiaW5kaW5ncy5mb3JFYWNoKGZ1bmN0aW9uKGJpbmRpbmcsIGluZGV4KXtcbiAgICAgICAgaWYoIWlzLmJpbmRpbmcoYmluZGluZykpe1xuICAgICAgICAgICAgYmluZGluZyA9IGNyZWF0ZUJpbmRpbmcoYmluZGluZyk7XG4gICAgICAgICAgICBiaW5kaW5ncy5zcGxpY2UoaW5kZXgsMSxiaW5kaW5nKTtcbiAgICAgICAgfVxuICAgICAgICBiaW5kaW5nLm9uKCdjaGFuZ2UnLCBjaGFuZ2UpO1xuICAgICAgICByZXN1bHRCaW5kaW5nLm9uKCdkZXRhY2gnLCBiaW5kaW5nLmRldGFjaCk7XG4gICAgfSk7XG5cbiAgICB2YXIgbGFzdEF0dGFjaGVkO1xuICAgIHJlc3VsdEJpbmRpbmcub24oJ2F0dGFjaCcsIGZ1bmN0aW9uKG9iamVjdCl7XG4gICAgICAgIHNlbGZDaGFuZ2luZyA9IHRydWU7XG4gICAgICAgIGJpbmRpbmdzLmZvckVhY2goZnVuY3Rpb24oYmluZGluZyl7XG4gICAgICAgICAgICBiaW5kaW5nLmF0dGFjaChvYmplY3QsIDEpO1xuICAgICAgICB9KTtcbiAgICAgICAgc2VsZkNoYW5naW5nID0gZmFsc2U7XG4gICAgICAgIGlmKGxhc3RBdHRhY2hlZCAhPT0gb2JqZWN0KXtcbiAgICAgICAgICAgIGNoYW5nZSgpO1xuICAgICAgICB9XG4gICAgICAgIGxhc3RBdHRhY2hlZCA9IG9iamVjdDtcbiAgICB9KTtcblxuICAgIHJldHVybiByZXN1bHRCaW5kaW5nO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVWYWx1ZUJpbmRpbmcoKXtcbiAgICB2YXIgdmFsdWVCaW5kaW5nID0gY3JlYXRlQmluZGluZygndmFsdWUnKTtcbiAgICB2YWx1ZUJpbmRpbmcuYXR0YWNoID0gZnVuY3Rpb24oKXtyZXR1cm4gdmFsdWVCaW5kaW5nO307XG4gICAgdmFsdWVCaW5kaW5nLmRldGFjaCA9IGZ1bmN0aW9uKCl7cmV0dXJuIHZhbHVlQmluZGluZzt9O1xuICAgIHJldHVybiB2YWx1ZUJpbmRpbmc7XG59XG5cbmZ1bmN0aW9uIGJpbmRpbmdUZW1wbGF0ZShuZXdWYWx1ZSl7XG4gICAgaWYoIWFyZ3VtZW50cy5sZW5ndGgpe1xuICAgICAgICByZXR1cm4gdGhpcy52YWx1ZTtcbiAgICB9XG5cbiAgICBpZih0aGlzLmJpbmRpbmcuX2Zhc3RuX2JpbmRpbmcgPT09ICcuJyl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJpbmRpbmcuX3NldChuZXdWYWx1ZSk7XG4gICAgcmV0dXJuIHRoaXMuYmluZGluZztcbn1cblxuZnVuY3Rpb24gY3JlYXRlQmluZGluZyhwYXRoLCBtb3JlKXtcblxuICAgIGlmKG1vcmUpeyAvLyB1c2VkIGluc3RlYWQgb2YgYXJndW1lbnRzLmxlbmd0aCBmb3IgcGVyZm9ybWFuY2VcbiAgICAgICAgcmV0dXJuIGZ1c2VCaW5kaW5nLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgaWYocGF0aCA9PSBudWxsKXtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZVZhbHVlQmluZGluZygpO1xuICAgIH1cblxuICAgIHZhciBiaW5kaW5nU2NvcGUgPSB7fSxcbiAgICAgICAgYmluZGluZyA9IGJpbmRpbmdTY29wZS5iaW5kaW5nID0gYmluZGluZ1RlbXBsYXRlLmJpbmQoYmluZGluZ1Njb3BlKSxcbiAgICAgICAgZGVzdHJveWVkO1xuXG4gICAgc2V0UHJvdG90eXBlT2YoYmluZGluZywgZnVuY3Rpb25FbWl0dGVyKTtcbiAgICBiaW5kaW5nLnNldE1heExpc3RlbmVycygxMDAwMCk7XG4gICAgYmluZGluZy5fYXJndW1lbnRzID0gW3BhdGhdO1xuICAgIGJpbmRpbmcuX21vZGVsID0gbmV3IEVudGkoZmFsc2UpO1xuICAgIGJpbmRpbmcuX2Zhc3RuX2JpbmRpbmcgPSBwYXRoO1xuICAgIGJpbmRpbmcuX2Zpcm0gPSAtSW5maW5pdHk7XG5cbiAgICBmdW5jdGlvbiBtb2RlbEF0dGFjaEhhbmRsZXIoZGF0YSl7XG4gICAgICAgIGJpbmRpbmcuX21vZGVsLmF0dGFjaChkYXRhKTtcbiAgICAgICAgYmluZGluZy5fY2hhbmdlKGJpbmRpbmcuX21vZGVsLmdldChwYXRoKSk7XG4gICAgICAgIGJpbmRpbmcuZW1pdCgnYXR0YWNoJywgZGF0YSwgMSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbW9kZWxEZXRhY2hIYW5kbGVyKCl7XG4gICAgICAgIGJpbmRpbmcuX21vZGVsLmRldGFjaCgpO1xuICAgIH1cblxuICAgIGJpbmRpbmcuYXR0YWNoID0gZnVuY3Rpb24ob2JqZWN0LCBmaXJtKXtcblxuICAgICAgICAvLyBJZiB0aGUgYmluZGluZyBpcyBiZWluZyBhc2tlZCB0byBhdHRhY2ggbG9vc2x5IHRvIGFuIG9iamVjdCxcbiAgICAgICAgLy8gYnV0IGl0IGhhcyBhbHJlYWR5IGJlZW4gZGVmaW5lZCBhcyBiZWluZyBmaXJtbHkgYXR0YWNoZWQsIGRvIG5vdCBhdHRhY2guXG4gICAgICAgIGlmKGZpcm1lcihiaW5kaW5nLCBmaXJtKSl7XG4gICAgICAgICAgICByZXR1cm4gYmluZGluZztcbiAgICAgICAgfVxuXG4gICAgICAgIGJpbmRpbmcuX2Zpcm0gPSBmaXJtO1xuXG4gICAgICAgIHZhciBpc0VudGkgPSBFbnRpLmlzRW50aShvYmplY3QpO1xuXG4gICAgICAgIGlmKGlzRW50aSAmJiBiaW5kaW5nU2NvcGUuYXR0YWNoZWRNb2RlbCA9PT0gb2JqZWN0KXtcbiAgICAgICAgICAgIHJldHVybiBiaW5kaW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoYmluZGluZ1Njb3BlLmF0dGFjaGVkTW9kZWwpe1xuICAgICAgICAgICAgYmluZGluZ1Njb3BlLmF0dGFjaGVkTW9kZWwucmVtb3ZlTGlzdGVuZXIoJ2F0dGFjaCcsIG1vZGVsQXR0YWNoSGFuZGxlcik7XG4gICAgICAgICAgICBiaW5kaW5nU2NvcGUuYXR0YWNoZWRNb2RlbC5yZW1vdmVMaXN0ZW5lcignZGV0YWNoJywgbW9kZWxEZXRhY2hIYW5kbGVyKTtcbiAgICAgICAgICAgIGJpbmRpbmdTY29wZS5hdHRhY2hlZE1vZGVsID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGlzRW50aSl7XG4gICAgICAgICAgICBiaW5kaW5nU2NvcGUuYXR0YWNoZWRNb2RlbCA9IG9iamVjdDtcbiAgICAgICAgICAgIGJpbmRpbmdTY29wZS5hdHRhY2hlZE1vZGVsLm9uKCdhdHRhY2gnLCBtb2RlbEF0dGFjaEhhbmRsZXIpO1xuICAgICAgICAgICAgYmluZGluZ1Njb3BlLmF0dGFjaGVkTW9kZWwub24oJ2RldGFjaCcsIG1vZGVsRGV0YWNoSGFuZGxlcik7XG4gICAgICAgICAgICBvYmplY3QgPSBvYmplY3QuX21vZGVsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoIShvYmplY3QgaW5zdGFuY2VvZiBPYmplY3QpKXtcbiAgICAgICAgICAgIG9iamVjdCA9IHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoYmluZGluZy5fbW9kZWwuX21vZGVsID09PSBvYmplY3Qpe1xuICAgICAgICAgICAgcmV0dXJuIGJpbmRpbmc7XG4gICAgICAgIH1cblxuICAgICAgICBtb2RlbEF0dGFjaEhhbmRsZXIob2JqZWN0KTtcblxuICAgICAgICByZXR1cm4gYmluZGluZztcbiAgICB9O1xuXG4gICAgYmluZGluZy5kZXRhY2ggPSBmdW5jdGlvbihmaXJtKXtcbiAgICAgICAgaWYoZmlybWVyKGJpbmRpbmcsIGZpcm0pKXtcbiAgICAgICAgICAgIHJldHVybiBiaW5kaW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgYmluZGluZ1Njb3BlLnZhbHVlID0gdW5kZWZpbmVkO1xuICAgICAgICBpZihiaW5kaW5nLl9tb2RlbC5pc0F0dGFjaGVkKCkpe1xuICAgICAgICAgICAgYmluZGluZy5fbW9kZWwuZGV0YWNoKCk7XG4gICAgICAgIH1cbiAgICAgICAgYmluZGluZy5lbWl0KCdkZXRhY2gnLCAxKTtcbiAgICAgICAgcmV0dXJuIGJpbmRpbmc7XG4gICAgfTtcbiAgICBiaW5kaW5nLl9zZXQgPSBmdW5jdGlvbihuZXdWYWx1ZSl7XG4gICAgICAgIGlmKHNhbWUoYmluZGluZy5fbW9kZWwuZ2V0KHBhdGgpLCBuZXdWYWx1ZSkpe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmKCFiaW5kaW5nLl9tb2RlbC5pc0F0dGFjaGVkKCkpe1xuICAgICAgICAgICAgYmluZGluZy5fbW9kZWwuYXR0YWNoKGJpbmRpbmcuX21vZGVsLmdldCgnLicpKTtcbiAgICAgICAgfVxuICAgICAgICBiaW5kaW5nLl9tb2RlbC5zZXQocGF0aCwgbmV3VmFsdWUpO1xuICAgIH07XG4gICAgYmluZGluZy5fY2hhbmdlID0gZnVuY3Rpb24obmV3VmFsdWUpe1xuICAgICAgICBiaW5kaW5nU2NvcGUudmFsdWUgPSBuZXdWYWx1ZTtcbiAgICAgICAgYmluZGluZy5lbWl0KCdjaGFuZ2UnLCBiaW5kaW5nKCkpO1xuICAgIH07XG4gICAgYmluZGluZy5jbG9uZSA9IGZ1bmN0aW9uKGtlZXBBdHRhY2htZW50KXtcbiAgICAgICAgdmFyIG5ld0JpbmRpbmcgPSBjcmVhdGVCaW5kaW5nLmFwcGx5KG51bGwsIGJpbmRpbmcuX2FyZ3VtZW50cyk7XG5cbiAgICAgICAgaWYoa2VlcEF0dGFjaG1lbnQpe1xuICAgICAgICAgICAgbmV3QmluZGluZy5hdHRhY2goYmluZGluZ1Njb3BlLmF0dGFjaGVkTW9kZWwgfHwgYmluZGluZy5fbW9kZWwuX21vZGVsLCBiaW5kaW5nLl9maXJtKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXdCaW5kaW5nO1xuICAgIH07XG4gICAgYmluZGluZy5kZXN0cm95ID0gZnVuY3Rpb24oc29mdCl7XG4gICAgICAgIGlmKGRlc3Ryb3llZCl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYoc29mdCAmJiBiaW5kaW5nLmxpc3RlbmVycygnY2hhbmdlJykubGVuZ3RoKXtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBkZXN0cm95ZWQgPSB0cnVlO1xuICAgICAgICBiaW5kaW5nLmVtaXQoJ2Rlc3Ryb3knKTtcbiAgICAgICAgYmluZGluZy5kZXRhY2goKTtcbiAgICAgICAgYmluZGluZy5fbW9kZWwuZGVzdHJveSgpO1xuICAgIH07XG5cbiAgICBiaW5kaW5nLmRlc3Ryb3llZCA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHJldHVybiBkZXN0cm95ZWQ7XG4gICAgfTtcblxuICAgIGlmKHBhdGggIT09ICcuJyl7XG4gICAgICAgIGJpbmRpbmcuX21vZGVsLm9uKHBhdGgsIGJpbmRpbmcuX2NoYW5nZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGJpbmRpbmc7XG59XG5cbmZ1bmN0aW9uIGZyb20odmFsdWVPckJpbmRpbmcpe1xuICAgIGlmKGlzLmJpbmRpbmcodmFsdWVPckJpbmRpbmcpKXtcbiAgICAgICAgcmV0dXJuIHZhbHVlT3JCaW5kaW5nO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVCaW5kaW5nKCkodmFsdWVPckJpbmRpbmcpO1xufVxuXG5jcmVhdGVCaW5kaW5nLmZyb20gPSBmcm9tO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZUJpbmRpbmc7IiwiZnVuY3Rpb24gaW5zZXJ0Q2hpbGQoZmFzdG4sIGNvbnRhaW5lciwgY2hpbGQsIGluZGV4KXtcbiAgICB2YXIgY3VycmVudEluZGV4ID0gY29udGFpbmVyLl9jaGlsZHJlbi5pbmRleE9mKGNoaWxkKSxcbiAgICAgICAgbmV3Q29tcG9uZW50ID0gZmFzdG4udG9Db21wb25lbnQoY2hpbGQpO1xuXG4gICAgaWYobmV3Q29tcG9uZW50ICE9PSBjaGlsZCl7XG4gICAgICAgIGNvbnRhaW5lci5fY2hpbGRyZW4uc3BsaWNlKGN1cnJlbnRJbmRleCwgMSwgbmV3Q29tcG9uZW50KTtcbiAgICB9XG5cbiAgICBpZighfmN1cnJlbnRJbmRleCB8fCBuZXdDb21wb25lbnQgIT09IGNoaWxkKXtcbiAgICAgICAgbmV3Q29tcG9uZW50LmF0dGFjaChjb250YWluZXIuc2NvcGUoKSwgMSk7XG4gICAgfVxuXG4gICAgaWYoY3VycmVudEluZGV4ICE9PSBpbmRleCl7XG4gICAgICAgIGlmKH5jdXJyZW50SW5kZXgpe1xuICAgICAgICAgICAgY29udGFpbmVyLl9jaGlsZHJlbi5zcGxpY2UoY3VycmVudEluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgICBjb250YWluZXIuX2NoaWxkcmVuLnNwbGljZShpbmRleCwgMCwgbmV3Q29tcG9uZW50KTtcbiAgICB9XG5cbiAgICBpZihjb250YWluZXIuZWxlbWVudCl7XG4gICAgICAgIGlmKCFuZXdDb21wb25lbnQuZWxlbWVudCl7XG4gICAgICAgICAgICBuZXdDb21wb25lbnQucmVuZGVyKCk7XG4gICAgICAgIH1cbiAgICAgICAgY29udGFpbmVyLl9pbnNlcnQobmV3Q29tcG9uZW50LmVsZW1lbnQsIGluZGV4KTtcbiAgICAgICAgbmV3Q29tcG9uZW50LmVtaXQoJ2luc2VydCcsIGNvbnRhaW5lcik7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRDb250YWluZXJFbGVtZW50KCl7XG4gICAgcmV0dXJuIHRoaXMuY29udGFpbmVyRWxlbWVudCB8fCB0aGlzLmVsZW1lbnQ7XG59XG5cbmZ1bmN0aW9uIGluc2VydChjaGlsZCwgaW5kZXgpe1xuICAgIHZhciBjaGlsZENvbXBvbmVudCA9IGNoaWxkLFxuICAgICAgICBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lcixcbiAgICAgICAgZmFzdG4gPSB0aGlzLmZhc3RuO1xuXG4gICAgaWYoaW5kZXggJiYgdHlwZW9mIGluZGV4ID09PSAnb2JqZWN0Jyl7XG4gICAgICAgIGNoaWxkQ29tcG9uZW50ID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICBpZihpc05hTihpbmRleCkpe1xuICAgICAgICBpbmRleCA9IGNvbnRhaW5lci5fY2hpbGRyZW4ubGVuZ3RoO1xuICAgIH1cblxuICAgIGlmKEFycmF5LmlzQXJyYXkoY2hpbGRDb21wb25lbnQpKXtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGlsZENvbXBvbmVudC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29udGFpbmVyLmluc2VydChjaGlsZENvbXBvbmVudFtpXSwgaSArIGluZGV4KTtcbiAgICAgICAgfVxuICAgIH1lbHNle1xuICAgICAgICBpbnNlcnRDaGlsZChmYXN0biwgY29udGFpbmVyLCBjaGlsZENvbXBvbmVudCwgaW5kZXgpO1xuICAgIH1cblxuICAgIHJldHVybiBjb250YWluZXI7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZmFzdG4sIGNvbXBvbmVudCwgdHlwZSwgc2V0dGluZ3MsIGNoaWxkcmVuKXtcbiAgICBjb21wb25lbnQuaW5zZXJ0ID0gaW5zZXJ0LmJpbmQoe1xuICAgICAgICBjb250YWluZXI6IGNvbXBvbmVudCxcbiAgICAgICAgZmFzdG46IGZhc3RuXG4gICAgfSk7XG5cbiAgICBjb21wb25lbnQuX2luc2VydCA9IGZ1bmN0aW9uKGVsZW1lbnQsIGluZGV4KXtcbiAgICAgICAgdmFyIGNvbnRhaW5lckVsZW1lbnQgPSBjb21wb25lbnQuZ2V0Q29udGFpbmVyRWxlbWVudCgpO1xuICAgICAgICBpZighY29udGFpbmVyRWxlbWVudCl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZihjb250YWluZXJFbGVtZW50LmNoaWxkTm9kZXNbaW5kZXhdID09PSBlbGVtZW50KXtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnRhaW5lckVsZW1lbnQuaW5zZXJ0QmVmb3JlKGVsZW1lbnQsIGNvbnRhaW5lckVsZW1lbnQuY2hpbGROb2Rlc1tpbmRleF0pO1xuICAgIH07XG5cbiAgICBjb21wb25lbnQucmVtb3ZlID0gZnVuY3Rpb24oY2hpbGRDb21wb25lbnQpe1xuICAgICAgICB2YXIgaW5kZXggPSBjb21wb25lbnQuX2NoaWxkcmVuLmluZGV4T2YoY2hpbGRDb21wb25lbnQpO1xuICAgICAgICBpZih+aW5kZXgpe1xuICAgICAgICAgICAgY29tcG9uZW50Ll9jaGlsZHJlbi5zcGxpY2UoaW5kZXgsMSk7XG4gICAgICAgIH1cblxuICAgICAgICBjaGlsZENvbXBvbmVudC5kZXRhY2goMSk7XG5cbiAgICAgICAgaWYoY2hpbGRDb21wb25lbnQuZWxlbWVudCl7XG4gICAgICAgICAgICBjb21wb25lbnQuX3JlbW92ZShjaGlsZENvbXBvbmVudC5lbGVtZW50KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBjb21wb25lbnQuX3JlbW92ZSA9IGZ1bmN0aW9uKGVsZW1lbnQpe1xuICAgICAgICB2YXIgY29udGFpbmVyRWxlbWVudCA9IGNvbXBvbmVudC5nZXRDb250YWluZXJFbGVtZW50KCk7XG5cbiAgICAgICAgaWYoIWVsZW1lbnQgfHwgIWNvbnRhaW5lckVsZW1lbnQgfHwgZWxlbWVudC5wYXJlbnROb2RlICE9PSBjb250YWluZXJFbGVtZW50KXtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnRhaW5lckVsZW1lbnQucmVtb3ZlQ2hpbGQoZWxlbWVudCk7XG4gICAgfTtcblxuICAgIGNvbXBvbmVudC5lbXB0eSA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHdoaWxlKGNvbXBvbmVudC5fY2hpbGRyZW4ubGVuZ3RoKXtcbiAgICAgICAgICAgIGNvbXBvbmVudC5yZW1vdmUoY29tcG9uZW50Ll9jaGlsZHJlbi5wb3AoKSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgY29tcG9uZW50LnJlcGxhY2VDaGlsZCA9IGZ1bmN0aW9uKG9sZENoaWxkLCBuZXdDaGlsZCl7XG4gICAgICAgIHZhciBpbmRleCA9IGNvbXBvbmVudC5fY2hpbGRyZW4uaW5kZXhPZihvbGRDaGlsZCk7XG5cbiAgICAgICAgaWYoIX5pbmRleCl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb21wb25lbnQucmVtb3ZlKG9sZENoaWxkKTtcbiAgICAgICAgY29tcG9uZW50Lmluc2VydChuZXdDaGlsZCwgaW5kZXgpO1xuICAgIH07XG5cbiAgICBjb21wb25lbnQuZ2V0Q29udGFpbmVyRWxlbWVudCA9IGdldENvbnRhaW5lckVsZW1lbnQuYmluZChjb21wb25lbnQpO1xuXG4gICAgY29tcG9uZW50Lm9uKCdyZW5kZXInLCBjb21wb25lbnQuaW5zZXJ0LmJpbmQobnVsbCwgY29tcG9uZW50Ll9jaGlsZHJlbiwgMCkpO1xuXG4gICAgY29tcG9uZW50Lm9uKCdhdHRhY2gnLCBmdW5jdGlvbihtb2RlbCwgZmlybSl7XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBjb21wb25lbnQuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgIGlmKGZhc3RuLmlzQ29tcG9uZW50KGNvbXBvbmVudC5fY2hpbGRyZW5baV0pKXtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQuX2NoaWxkcmVuW2ldLmF0dGFjaChtb2RlbCwgZmlybSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbXBvbmVudC5vbignZGVzdHJveScsIGZ1bmN0aW9uKGRhdGEsIGZpcm0pe1xuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgY29tcG9uZW50Ll9jaGlsZHJlbi5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICBpZihmYXN0bi5pc0NvbXBvbmVudChjb21wb25lbnQuX2NoaWxkcmVuW2ldKSl7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jaGlsZHJlbltpXS5kZXN0cm95KGZpcm0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gY29tcG9uZW50O1xufTsiLCJ2YXIgc2V0aWZ5ID0gcmVxdWlyZSgnc2V0aWZ5JyksXG4gICAgY2xhc3Npc3QgPSByZXF1aXJlKCdjbGFzc2lzdCcpO1xuXG5mdW5jdGlvbiB1cGRhdGVUZXh0UHJvcGVydHkoZ2VuZXJpYywgZWxlbWVudCwgdmFsdWUpe1xuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpe1xuICAgICAgICByZXR1cm4gZWxlbWVudC50ZXh0Q29udGVudDtcbiAgICB9XG4gICAgZWxlbWVudC50ZXh0Q29udGVudCA9ICh2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIGNsYXNzOiBmdW5jdGlvbihnZW5lcmljLCBlbGVtZW50LCB2YWx1ZSl7XG4gICAgICAgIGlmKCFnZW5lcmljLl9jbGFzc2lzdCl7XG4gICAgICAgICAgICBnZW5lcmljLl9jbGFzc2lzdCA9IGNsYXNzaXN0KGVsZW1lbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoYXJndW1lbnRzLmxlbmd0aCA8IDMpe1xuICAgICAgICAgICAgcmV0dXJuIGdlbmVyaWMuX2NsYXNzaXN0KCk7XG4gICAgICAgIH1cblxuICAgICAgICBnZW5lcmljLl9jbGFzc2lzdCh2YWx1ZSk7XG4gICAgfSxcbiAgICBkaXNwbGF5OiBmdW5jdGlvbihnZW5lcmljLCBlbGVtZW50LCB2YWx1ZSl7XG4gICAgICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpe1xuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQuc3R5bGUuZGlzcGxheSAhPT0gJ25vbmUnO1xuICAgICAgICB9XG4gICAgICAgIGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IHZhbHVlID8gbnVsbCA6ICdub25lJztcbiAgICB9LFxuICAgIGRpc2FibGVkOiBmdW5jdGlvbihnZW5lcmljLCBlbGVtZW50LCB2YWx1ZSl7XG4gICAgICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpe1xuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQuaGFzQXR0cmlidXRlKCdkaXNhYmxlZCcpO1xuICAgICAgICB9XG4gICAgICAgIGlmKHZhbHVlKXtcbiAgICAgICAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKCdkaXNhYmxlZCcsICdkaXNhYmxlZCcpO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdkaXNhYmxlZCcpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICB0ZXh0Q29udGVudDogdXBkYXRlVGV4dFByb3BlcnR5LFxuICAgIGlubmVyVGV4dDogdXBkYXRlVGV4dFByb3BlcnR5LFxuICAgIGlubmVySFRNTDogdXBkYXRlVGV4dFByb3BlcnR5LFxuICAgIHZhbHVlOiBmdW5jdGlvbihnZW5lcmljLCBlbGVtZW50LCB2YWx1ZSl7XG4gICAgICAgIHZhciBpbnB1dFR5cGUgPSBlbGVtZW50LnR5cGU7XG5cbiAgICAgICAgaWYoZWxlbWVudC5ub2RlTmFtZSA9PT0gJ0lOUFVUJyAmJiBpbnB1dFR5cGUgPT09ICdkYXRlJyl7XG4gICAgICAgICAgICBpZihhcmd1bWVudHMubGVuZ3RoID09PSAyKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZWxlbWVudC52YWx1ZSA/IG5ldyBEYXRlKGVsZW1lbnQudmFsdWUucmVwbGFjZSgvLS9nLCcvJykucmVwbGFjZSgnVCcsJyAnKSkgOiBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YWx1ZSA9IHZhbHVlICE9IG51bGwgPyBuZXcgRGF0ZSh2YWx1ZSkgOiBudWxsO1xuXG4gICAgICAgICAgICBpZighdmFsdWUgfHwgaXNOYU4odmFsdWUpKXtcbiAgICAgICAgICAgICAgICBlbGVtZW50LnZhbHVlID0gbnVsbDtcbiAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgIGVsZW1lbnQudmFsdWUgPSBbXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlLmdldEZ1bGxZZWFyKCksXG4gICAgICAgICAgICAgICAgICAgICgnMCcgKyAodmFsdWUuZ2V0TW9udGgoKSArIDEpKS5zbGljZSgtMiksXG4gICAgICAgICAgICAgICAgICAgICgnMCcgKyB2YWx1ZS5nZXREYXRlKCkpLnNsaWNlKC0yKVxuICAgICAgICAgICAgICAgIF0uam9pbignLScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoYXJndW1lbnRzLmxlbmd0aCA9PT0gMil7XG4gICAgICAgICAgICByZXR1cm4gZWxlbWVudC52YWx1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZih2YWx1ZSA9PT0gdW5kZWZpbmVkKXtcbiAgICAgICAgICAgIHZhbHVlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHNldGlmeShlbGVtZW50LCB2YWx1ZSk7XG4gICAgfSxcbiAgICBzdHlsZTogZnVuY3Rpb24oZ2VuZXJpYywgZWxlbWVudCwgdmFsdWUpe1xuICAgICAgICBpZihhcmd1bWVudHMubGVuZ3RoID09PSAyKXtcbiAgICAgICAgICAgIHJldHVybiBlbGVtZW50LnN0eWxlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yKHZhciBrZXkgaW4gdmFsdWUpe1xuICAgICAgICAgICAgZWxlbWVudC5zdHlsZVtrZXldID0gdmFsdWVba2V5XTtcbiAgICAgICAgfVxuICAgIH1cbn07IiwiLy8gSXMgdGhlIGVudGl0eSBmaXJtZXIgdGhhbiB0aGUgbmV3IGZpcm1uZXNzXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVudGl0eSwgZmlybSl7XG4gICAgaWYoZmlybSAhPSBudWxsICYmIChlbnRpdHkuX2Zpcm0gPT09IHVuZGVmaW5lZCB8fCBmaXJtIDwgZW50aXR5Ll9maXJtKSl7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbn07IiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcixcbiAgICBmdW5jdGlvbkVtaXR0ZXJQcm90b3R5cGUgPSBmdW5jdGlvbigpe307XG5cbmZvcih2YXIga2V5IGluIEV2ZW50RW1pdHRlci5wcm90b3R5cGUpe1xuICAgIGZ1bmN0aW9uRW1pdHRlclByb3RvdHlwZVtrZXldID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZVtrZXldO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uRW1pdHRlclByb3RvdHlwZTsiLCJ2YXIgY29udGFpbmVyQ29tcG9uZW50ID0gcmVxdWlyZSgnLi9jb250YWluZXJDb21wb25lbnQnKSxcbiAgICBzY2hlZHVsZSA9IHJlcXVpcmUoJy4vc2NoZWR1bGUnKSxcbiAgICBmYW5jeVByb3BzID0gcmVxdWlyZSgnLi9mYW5jeVByb3BzJyksXG4gICAgbWF0Y2hEb21IYW5kbGVyTmFtZSA9IC9eKCg/OmVsXFwuKT8pKFteLiBdKykoPzpcXC4oY2FwdHVyZSkpPyQvLFxuICAgIEdFTkVSSUMgPSAnX2dlbmVyaWMnO1xuXG5mdW5jdGlvbiBjcmVhdGVQcm9wZXJ0aWVzKGZhc3RuLCBjb21wb25lbnQsIHNldHRpbmdzKXtcbiAgICBmb3IodmFyIGtleSBpbiBzZXR0aW5ncyl7XG4gICAgICAgIHZhciBzZXR0aW5nID0gc2V0dGluZ3Nba2V5XTtcblxuICAgICAgICBpZih0eXBlb2Ygc2V0dGluZyA9PT0gJ2Z1bmN0aW9uJyAmJiAhZmFzdG4uaXNQcm9wZXJ0eShzZXR0aW5nKSAmJiAhZmFzdG4uaXNCaW5kaW5nKHNldHRpbmcpKXtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29tcG9uZW50LmFkZERvbVByb3BlcnR5KGtleSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBhZGREb21IYW5kbGVyKGNvbXBvbmVudCwgZWxlbWVudCwgaGFuZGxlck5hbWUsIGV2ZW50TmFtZSwgY2FwdHVyZSl7XG4gICAgdmFyIGV2ZW50UGFydHMgPSBoYW5kbGVyTmFtZS5zcGxpdCgnLicpO1xuXG4gICAgaWYoZXZlbnRQYXJ0c1swXSA9PT0gJ29uJyl7XG4gICAgICAgIGV2ZW50UGFydHMuc2hpZnQoKTtcbiAgICB9XG5cbiAgICB2YXIgaGFuZGxlciA9IGZ1bmN0aW9uKGV2ZW50KXtcbiAgICAgICAgICAgIGNvbXBvbmVudC5lbWl0KGhhbmRsZXJOYW1lLCBldmVudCwgY29tcG9uZW50LnNjb3BlKCkpO1xuICAgICAgICB9O1xuXG4gICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgaGFuZGxlciwgY2FwdHVyZSk7XG5cbiAgICBjb21wb25lbnQub24oJ2Rlc3Ryb3knLCBmdW5jdGlvbigpe1xuICAgICAgICBlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBoYW5kbGVyLCBjYXB0dXJlKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gYWRkRG9tSGFuZGxlcnMoY29tcG9uZW50LCBlbGVtZW50LCBldmVudE5hbWVzKXtcbiAgICB2YXIgZXZlbnRzID0gZXZlbnROYW1lcy5zcGxpdCgnICcpO1xuXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGV2ZW50cy5sZW5ndGg7IGkrKyl7XG4gICAgICAgIHZhciBldmVudE5hbWUgPSBldmVudHNbaV0sXG4gICAgICAgICAgICBtYXRjaCA9IGV2ZW50TmFtZS5tYXRjaChtYXRjaERvbUhhbmRsZXJOYW1lKTtcblxuICAgICAgICBpZighbWF0Y2gpe1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZihtYXRjaFsxXSB8fCAnb24nICsgbWF0Y2hbMl0gaW4gZWxlbWVudCl7XG4gICAgICAgICAgICBhZGREb21IYW5kbGVyKGNvbXBvbmVudCwgZWxlbWVudCwgZXZlbnROYW1lcywgbWF0Y2hbMl0sIG1hdGNoWzNdKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gYWRkQXV0b0hhbmRsZXIoY29tcG9uZW50LCBlbGVtZW50LCBrZXksIHNldHRpbmdzKXtcbiAgICBpZighc2V0dGluZ3Nba2V5XSl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgYXV0b0V2ZW50ID0gc2V0dGluZ3Nba2V5XS5zcGxpdCgnOicpLFxuICAgICAgICBldmVudE5hbWUgPSBrZXkuc2xpY2UoMik7XG5cbiAgICBkZWxldGUgc2V0dGluZ3Nba2V5XTtcblxuICAgIHZhciBoYW5kbGVyID0gZnVuY3Rpb24oZXZlbnQpe1xuICAgICAgICB2YXIgZmFuY3lQcm9wID0gZmFuY3lQcm9wc1thdXRvRXZlbnRbMV1dLFxuICAgICAgICAgICAgdmFsdWUgPSBmYW5jeVByb3AgPyBmYW5jeVByb3AoY29tcG9uZW50LCBlbGVtZW50KSA6IGVsZW1lbnRbYXV0b0V2ZW50WzFdXTtcblxuICAgICAgICBjb21wb25lbnRbYXV0b0V2ZW50WzBdXSh2YWx1ZSk7XG4gICAgfTtcblxuICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGhhbmRsZXIpO1xuXG4gICAgY29tcG9uZW50Lm9uKCdkZXN0cm95JywgZnVuY3Rpb24oKXtcbiAgICAgICAgZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgaGFuZGxlcik7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGFkZERvbVByb3BlcnR5KGZhc3RuLCBrZXksIHByb3BlcnR5KXtcbiAgICB2YXIgY29tcG9uZW50ID0gdGhpcztcblxuICAgIHByb3BlcnR5ID0gcHJvcGVydHkgfHwgY29tcG9uZW50W2tleV0gfHwgZmFzdG4ucHJvcGVydHkoKTtcbiAgICBjb21wb25lbnQuc2V0UHJvcGVydHkoa2V5LCBwcm9wZXJ0eSk7XG5cbiAgICBmdW5jdGlvbiB1cGRhdGUoKXtcbiAgICAgICAgdmFyIGVsZW1lbnQgPSBjb21wb25lbnQuZ2V0UHJvcGVydHlFbGVtZW50KGtleSksXG4gICAgICAgICAgICB2YWx1ZSA9IHByb3BlcnR5KCk7XG5cbiAgICAgICAgaWYoIWVsZW1lbnQgfHwgY29tcG9uZW50LmRlc3Ryb3llZCgpKXtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpc1Byb3BlcnR5ID0ga2V5IGluIGVsZW1lbnQsXG4gICAgICAgICAgICBmYW5jeVByb3AgPSBmYW5jeVByb3BzW2tleV0sXG4gICAgICAgICAgICBwcmV2aW91cyA9IGZhbmN5UHJvcCA/IGZhbmN5UHJvcChjb21wb25lbnQsIGVsZW1lbnQpIDogaXNQcm9wZXJ0eSA/IGVsZW1lbnRba2V5XSA6IGVsZW1lbnQuZ2V0QXR0cmlidXRlKGtleSk7XG5cbiAgICAgICAgaWYoIWZhbmN5UHJvcCAmJiAhaXNQcm9wZXJ0eSAmJiB2YWx1ZSA9PSBudWxsKXtcbiAgICAgICAgICAgIHZhbHVlID0gJyc7XG4gICAgICAgIH1cblxuICAgICAgICBpZih2YWx1ZSAhPT0gcHJldmlvdXMpe1xuICAgICAgICAgICAgaWYoZmFuY3lQcm9wKXtcbiAgICAgICAgICAgICAgICBmYW5jeVByb3AoY29tcG9uZW50LCBlbGVtZW50LCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihpc1Byb3BlcnR5KXtcbiAgICAgICAgICAgICAgICBlbGVtZW50W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKHR5cGVvZiB2YWx1ZSAhPT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnKXtcbiAgICAgICAgICAgICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZShrZXksIHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByb3BlcnR5LnVwZGF0ZXIodXBkYXRlKTtcbn1cblxuZnVuY3Rpb24gb25SZW5kZXIoKXtcbiAgICB2YXIgY29tcG9uZW50ID0gdGhpcyxcbiAgICAgICAgZWxlbWVudDtcblxuICAgIGZvcih2YXIga2V5IGluIGNvbXBvbmVudC5fc2V0dGluZ3Mpe1xuICAgICAgICBlbGVtZW50ID0gY29tcG9uZW50LmdldEV2ZW50RWxlbWVudChrZXkpO1xuICAgICAgICBpZihrZXkuc2xpY2UoMCwyKSA9PT0gJ29uJyAmJiBrZXkgaW4gZWxlbWVudCl7XG4gICAgICAgICAgICBhZGRBdXRvSGFuZGxlcihjb21wb25lbnQsIGVsZW1lbnQsIGtleSwgY29tcG9uZW50Ll9zZXR0aW5ncyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IodmFyIGV2ZW50S2V5IGluIGNvbXBvbmVudC5fZXZlbnRzKXtcbiAgICAgICAgZWxlbWVudCA9IGNvbXBvbmVudC5nZXRFdmVudEVsZW1lbnQoa2V5KTtcbiAgICAgICAgYWRkRG9tSGFuZGxlcnMoY29tcG9uZW50LCBlbGVtZW50LCBldmVudEtleSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZW5kZXIoKXtcbiAgICB0aGlzLmVsZW1lbnQgPSB0aGlzLmNyZWF0ZUVsZW1lbnQodGhpcy5fc2V0dGluZ3MudGFnTmFtZSB8fCB0aGlzLl90YWdOYW1lKTtcblxuICAgIHRoaXMuZW1pdCgncmVuZGVyJyk7XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbmZ1bmN0aW9uIGdlbmVyaWNDb21wb25lbnQoZmFzdG4sIGNvbXBvbmVudCwgdHlwZSwgc2V0dGluZ3MsIGNoaWxkcmVuKXtcbiAgICBpZihjb21wb25lbnQuaXModHlwZSkpe1xuICAgICAgICByZXR1cm4gY29tcG9uZW50O1xuICAgIH1cblxuICAgIGlmKHR5cGUgPT09IEdFTkVSSUMpe1xuICAgICAgICBjb21wb25lbnQuX3RhZ05hbWUgPSBjb21wb25lbnQuX3RhZ05hbWUgfHwgJ2Rpdic7XG4gICAgfWVsc2V7XG4gICAgICAgIGNvbXBvbmVudC5fdGFnTmFtZSA9IHR5cGU7XG4gICAgfVxuXG4gICAgaWYoY29tcG9uZW50LmlzKEdFTkVSSUMpKXtcbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgICB9XG5cbiAgICBjb21wb25lbnQuZXh0ZW5kKCdfY29udGFpbmVyJywgc2V0dGluZ3MsIGNoaWxkcmVuKTtcblxuICAgIGNvbXBvbmVudC5hZGREb21Qcm9wZXJ0eSA9IGFkZERvbVByb3BlcnR5LmJpbmQoY29tcG9uZW50LCBmYXN0bik7XG4gICAgY29tcG9uZW50LmdldEV2ZW50RWxlbWVudCA9IGNvbXBvbmVudC5nZXRDb250YWluZXJFbGVtZW50O1xuICAgIGNvbXBvbmVudC5nZXRQcm9wZXJ0eUVsZW1lbnQgPSBjb21wb25lbnQuZ2V0Q29udGFpbmVyRWxlbWVudDtcbiAgICBjb21wb25lbnQudXBkYXRlUHJvcGVydHkgPSBnZW5lcmljQ29tcG9uZW50LnVwZGF0ZVByb3BlcnR5O1xuICAgIGNvbXBvbmVudC5jcmVhdGVFbGVtZW50ID0gZ2VuZXJpY0NvbXBvbmVudC5jcmVhdGVFbGVtZW50O1xuXG4gICAgY3JlYXRlUHJvcGVydGllcyhmYXN0biwgY29tcG9uZW50LCBzZXR0aW5ncyk7XG5cbiAgICBjb21wb25lbnQucmVuZGVyID0gcmVuZGVyLmJpbmQoY29tcG9uZW50KTtcblxuICAgIGNvbXBvbmVudC5vbigncmVuZGVyJywgb25SZW5kZXIpO1xuXG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbn1cblxuZ2VuZXJpY0NvbXBvbmVudC51cGRhdGVQcm9wZXJ0eSA9IGZ1bmN0aW9uKGNvbXBvbmVudCwgcHJvcGVydHksIHVwZGF0ZSl7XG4gICAgaWYodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyAmJiBkb2N1bWVudC5jb250YWlucyhjb21wb25lbnQuZWxlbWVudCkpe1xuICAgICAgICBzY2hlZHVsZShwcm9wZXJ0eSwgdXBkYXRlKTtcbiAgICB9ZWxzZXtcbiAgICAgICAgdXBkYXRlKCk7XG4gICAgfVxufTtcblxuZ2VuZXJpY0NvbXBvbmVudC5jcmVhdGVFbGVtZW50ID0gZnVuY3Rpb24odGFnTmFtZSl7XG4gICAgaWYodGFnTmFtZSBpbnN0YW5jZW9mIE5vZGUpe1xuICAgICAgICByZXR1cm4gdGFnTmFtZTtcbiAgICB9XG4gICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnTmFtZSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGdlbmVyaWNDb21wb25lbnQ7IiwidmFyIGNyZWF0ZVByb3BlcnR5ID0gcmVxdWlyZSgnLi9wcm9wZXJ0eScpLFxuICAgIGNyZWF0ZUJpbmRpbmcgPSByZXF1aXJlKCcuL2JpbmRpbmcnKSxcbiAgICBCYXNlQ29tcG9uZW50ID0gcmVxdWlyZSgnLi9iYXNlQ29tcG9uZW50JyksXG4gICAgY3JlbCA9IHJlcXVpcmUoJ2NyZWwnKSxcbiAgICBFbnRpID0gcmVxdWlyZSgnZW50aScpLFxuICAgIG9iamVjdEFzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKSxcbiAgICBpcyA9IHJlcXVpcmUoJy4vaXMnKTtcblxuZnVuY3Rpb24gaW5mbGF0ZVByb3BlcnRpZXMoY29tcG9uZW50LCBzZXR0aW5ncyl7XG4gICAgZm9yKHZhciBrZXkgaW4gc2V0dGluZ3Mpe1xuICAgICAgICB2YXIgc2V0dGluZyA9IHNldHRpbmdzW2tleV0sXG4gICAgICAgICAgICBwcm9wZXJ0eSA9IGNvbXBvbmVudFtrZXldO1xuXG4gICAgICAgIGlmKGlzLnByb3BlcnR5KHNldHRpbmdzW2tleV0pKXtcblxuICAgICAgICAgICAgaWYoaXMucHJvcGVydHkocHJvcGVydHkpKXtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eS5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNldHRpbmcuYWRkVG8oY29tcG9uZW50LCBrZXkpO1xuXG4gICAgICAgIH1lbHNlIGlmKGlzLnByb3BlcnR5KHByb3BlcnR5KSl7XG5cbiAgICAgICAgICAgIGlmKGlzLmJpbmRpbmcoc2V0dGluZykpe1xuICAgICAgICAgICAgICAgIHByb3BlcnR5LmJpbmRpbmcoc2V0dGluZyk7XG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eShzZXR0aW5nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcHJvcGVydHkuYWRkVG8oY29tcG9uZW50LCBrZXkpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZUV4cGVjdGVkQ29tcG9uZW50cyhjb21wb25lbnRzLCBjb21wb25lbnROYW1lLCBleHBlY3RlZENvbXBvbmVudHMpe1xuICAgIGV4cGVjdGVkQ29tcG9uZW50cyA9IGV4cGVjdGVkQ29tcG9uZW50cy5maWx0ZXIoZnVuY3Rpb24oY29tcG9uZW50TmFtZSl7XG4gICAgICAgIHJldHVybiAhKGNvbXBvbmVudE5hbWUgaW4gY29tcG9uZW50cyk7XG4gICAgfSk7XG5cbiAgICBpZihleHBlY3RlZENvbXBvbmVudHMubGVuZ3RoKXtcbiAgICAgICAgY29uc29sZS53YXJuKFtcbiAgICAgICAgICAgICdmYXN0bihcIicgKyBjb21wb25lbnROYW1lICsgJ1wiKSB1c2VzIHNvbWUgY29tcG9uZW50cyB0aGF0IGhhdmUgbm90IGJlZW4gcmVnaXN0ZXJlZCB3aXRoIGZhc3RuJyxcbiAgICAgICAgICAgICdFeHBlY3RlZCBjb25wb25lbnQgY29uc3RydWN0b3JzOiAnICsgZXhwZWN0ZWRDb21wb25lbnRzLmpvaW4oJywgJylcbiAgICAgICAgXS5qb2luKCdcXG5cXG4nKSk7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGNvbXBvbmVudHMsIGRlYnVnKXtcblxuICAgIGlmKCFjb21wb25lbnRzIHx8IHR5cGVvZiBjb21wb25lbnRzICE9PSAnb2JqZWN0Jyl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignZmFzdG4gbXVzdCBiZSBpbml0aWFsaXNlZCB3aXRoIGEgY29tcG9uZW50cyBvYmplY3QnKTtcbiAgICB9XG5cbiAgICBjb21wb25lbnRzLl9jb250YWluZXIgPSBjb21wb25lbnRzLl9jb250YWluZXIgfHwgcmVxdWlyZSgnLi9jb250YWluZXJDb21wb25lbnQnKTtcblxuICAgIGZ1bmN0aW9uIGZhc3RuKHR5cGUpe1xuXG4gICAgICAgIHZhciBhcmdzID0gW107XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspe1xuICAgICAgICAgICAgYXJnc1tpXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBzZXR0aW5ncyA9IGFyZ3NbMV0sXG4gICAgICAgICAgICBjaGlsZHJlbkluZGV4ID0gMixcbiAgICAgICAgICAgIHNldHRpbmdzQ2hpbGQgPSBmYXN0bi50b0NvbXBvbmVudChhcmdzWzFdKTtcblxuICAgICAgICBpZihBcnJheS5pc0FycmF5KGFyZ3NbMV0pIHx8IHNldHRpbmdzQ2hpbGQgfHwgIWFyZ3NbMV0pe1xuICAgICAgICAgICAgYXJnc1sxXSA9IHNldHRpbmdzQ2hpbGQgfHwgYXJnc1sxXTtcbiAgICAgICAgICAgIGNoaWxkcmVuSW5kZXgtLTtcbiAgICAgICAgICAgIHNldHRpbmdzID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHNldHRpbmdzID0gb2JqZWN0QXNzaWduKHt9LCBzZXR0aW5ncyB8fCB7fSk7XG5cbiAgICAgICAgdmFyIHR5cGVzID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCgnOicpIDogQXJyYXkuaXNBcnJheSh0eXBlKSA/IHR5cGUgOiBbdHlwZV0sXG4gICAgICAgICAgICBiYXNlVHlwZSxcbiAgICAgICAgICAgIGNoaWxkcmVuID0gYXJncy5zbGljZShjaGlsZHJlbkluZGV4KSxcbiAgICAgICAgICAgIGNvbXBvbmVudCA9IGZhc3RuLmJhc2UodHlwZSwgc2V0dGluZ3MsIGNoaWxkcmVuKTtcblxuICAgICAgICB3aGlsZShiYXNlVHlwZSA9IHR5cGVzLnNoaWZ0KCkpe1xuICAgICAgICAgICAgY29tcG9uZW50LmV4dGVuZChiYXNlVHlwZSwgc2V0dGluZ3MsIGNoaWxkcmVuKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbXBvbmVudC5fcHJvcGVydGllcyA9IHt9O1xuXG4gICAgICAgIGluZmxhdGVQcm9wZXJ0aWVzKGNvbXBvbmVudCwgc2V0dGluZ3MpO1xuXG4gICAgICAgIHJldHVybiBjb21wb25lbnQ7XG4gICAgfVxuXG4gICAgZmFzdG4udG9Db21wb25lbnQgPSBmdW5jdGlvbihjb21wb25lbnQpe1xuICAgICAgICBpZihjb21wb25lbnQgPT0gbnVsbCl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYoaXMuY29tcG9uZW50KGNvbXBvbmVudCkpe1xuICAgICAgICAgICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgICAgICAgfVxuICAgICAgICBpZih0eXBlb2YgY29tcG9uZW50ICE9PSAnb2JqZWN0JyB8fCBjb21wb25lbnQgaW5zdGFuY2VvZiBEYXRlKXtcbiAgICAgICAgICAgIHJldHVybiBmYXN0bigndGV4dCcsIHthdXRvOiB0cnVlfSwgY29tcG9uZW50KTtcbiAgICAgICAgfVxuICAgICAgICBpZihjcmVsLmlzRWxlbWVudChjb21wb25lbnQpKXtcbiAgICAgICAgICAgIHJldHVybiBmYXN0bihjb21wb25lbnQpO1xuICAgICAgICB9XG4gICAgICAgIGlmKGNyZWwuaXNOb2RlKGNvbXBvbmVudCkpe1xuICAgICAgICAgICAgcmV0dXJuIGZhc3RuKCd0ZXh0Jywge2F1dG86IHRydWV9LCBjb21wb25lbnQudGV4dENvbnRlbnQpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGZhc3RuLmRlYnVnID0gZGVidWc7XG4gICAgZmFzdG4ucHJvcGVydHkgPSBjcmVhdGVQcm9wZXJ0eTtcbiAgICBmYXN0bi5iaW5kaW5nID0gY3JlYXRlQmluZGluZztcbiAgICBmYXN0bi5pc0NvbXBvbmVudCA9IGlzLmNvbXBvbmVudDtcbiAgICBmYXN0bi5pc0JpbmRpbmcgPSBpcy5iaW5kaW5nO1xuICAgIGZhc3RuLmlzRGVmYXVsdEJpbmRpbmcgPSBpcy5kZWZhdWx0QmluZGluZztcbiAgICBmYXN0bi5pc0JpbmRpbmdPYmplY3QgPSBpcy5iaW5kaW5nT2JqZWN0O1xuICAgIGZhc3RuLmlzUHJvcGVydHkgPSBpcy5wcm9wZXJ0eTtcbiAgICBmYXN0bi5jb21wb25lbnRzID0gY29tcG9uZW50cztcbiAgICBmYXN0bi5Nb2RlbCA9IEVudGk7XG5cbiAgICBmYXN0bi5iYXNlID0gZnVuY3Rpb24odHlwZSwgc2V0dGluZ3MsIGNoaWxkcmVuKXtcbiAgICAgICAgcmV0dXJuIG5ldyBCYXNlQ29tcG9uZW50KGZhc3RuLCB0eXBlLCBzZXR0aW5ncywgY2hpbGRyZW4pO1xuICAgIH07XG5cbiAgICBmb3IodmFyIGtleSBpbiBjb21wb25lbnRzKXtcbiAgICAgICAgdmFyIGNvbXBvbmVudENvbnN0cnVjdG9yID0gY29tcG9uZW50c1trZXldO1xuXG4gICAgICAgIGlmKGNvbXBvbmVudENvbnN0cnVjdG9yLmV4cGVjdGVkQ29tcG9uZW50cyl7XG4gICAgICAgICAgICB2YWxpZGF0ZUV4cGVjdGVkQ29tcG9uZW50cyhjb21wb25lbnRzLCBrZXksIGNvbXBvbmVudENvbnN0cnVjdG9yLmV4cGVjdGVkQ29tcG9uZW50cyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFzdG47XG59OyIsInZhciBGVU5DVElPTiA9ICdmdW5jdGlvbicsXG4gICAgT0JKRUNUID0gJ29iamVjdCcsXG4gICAgRkFTVE5CSU5ESU5HID0gJ19mYXN0bl9iaW5kaW5nJyxcbiAgICBGQVNUTlBST1BFUlRZID0gJ19mYXN0bl9wcm9wZXJ0eScsXG4gICAgRkFTVE5DT01QT05FTlQgPSAnX2Zhc3RuX2NvbXBvbmVudCcsXG4gICAgREVGQVVMVEJJTkRJTkcgPSAnX2RlZmF1bHRfYmluZGluZyc7XG5cbmZ1bmN0aW9uIGlzQ29tcG9uZW50KHRoaW5nKXtcbiAgICByZXR1cm4gdGhpbmcgJiYgdHlwZW9mIHRoaW5nID09PSBPQkpFQ1QgJiYgRkFTVE5DT01QT05FTlQgaW4gdGhpbmc7XG59XG5cbmZ1bmN0aW9uIGlzQmluZGluZ09iamVjdCh0aGluZyl7XG4gICAgcmV0dXJuIHRoaW5nICYmIHR5cGVvZiB0aGluZyA9PT0gT0JKRUNUICYmIEZBU1ROQklORElORyBpbiB0aGluZztcbn1cblxuZnVuY3Rpb24gaXNCaW5kaW5nKHRoaW5nKXtcbiAgICByZXR1cm4gdHlwZW9mIHRoaW5nID09PSBGVU5DVElPTiAmJiBGQVNUTkJJTkRJTkcgaW4gdGhpbmc7XG59XG5cbmZ1bmN0aW9uIGlzUHJvcGVydHkodGhpbmcpe1xuICAgIHJldHVybiB0eXBlb2YgdGhpbmcgPT09IEZVTkNUSU9OICYmIEZBU1ROUFJPUEVSVFkgaW4gdGhpbmc7XG59XG5cbmZ1bmN0aW9uIGlzRGVmYXVsdEJpbmRpbmcodGhpbmcpe1xuICAgIHJldHVybiB0eXBlb2YgdGhpbmcgPT09IEZVTkNUSU9OICYmIEZBU1ROQklORElORyBpbiB0aGluZyAmJiBERUZBVUxUQklORElORyBpbiB0aGluZztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgY29tcG9uZW50OiBpc0NvbXBvbmVudCxcbiAgICBiaW5kaW5nT2JqZWN0OiBpc0JpbmRpbmdPYmplY3QsXG4gICAgYmluZGluZzogaXNCaW5kaW5nLFxuICAgIGRlZmF1bHRCaW5kaW5nOiBpc0RlZmF1bHRCaW5kaW5nLFxuICAgIHByb3BlcnR5OiBpc1Byb3BlcnR5XG59OyIsInZhciBmbGF0dGVuID0gcmVxdWlyZSgnZmxhdHRlbicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVsZW1lbnQpe1xuICAgIHZhciBsYXN0Q2xhc3NlcyA9IFtdO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKGNsYXNzZXMpe1xuXG4gICAgICAgIGlmKCFhcmd1bWVudHMubGVuZ3RoKXtcbiAgICAgICAgICAgIHJldHVybiBsYXN0Q2xhc3Nlcy5qb2luKCcgJyk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBjbGVhbkNsYXNzTmFtZShyZXN1bHQsIGNsYXNzTmFtZSl7XG4gICAgICAgICAgICBpZih0eXBlb2YgY2xhc3NOYW1lID09PSAnc3RyaW5nJyAmJiBjbGFzc05hbWUubWF0Y2goL1xccy8pKXtcbiAgICAgICAgICAgICAgICBjbGFzc05hbWUgPSBjbGFzc05hbWUuc3BsaXQoJyAnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYoQXJyYXkuaXNBcnJheShjbGFzc05hbWUpKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0LmNvbmNhdChjbGFzc05hbWUucmVkdWNlKGNsZWFuQ2xhc3NOYW1lLCBbXSkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihjbGFzc05hbWUgIT0gbnVsbCAmJiBjbGFzc05hbWUgIT09ICcnKXtcbiAgICAgICAgICAgICAgICByZXN1bHQucHVzaChTdHJpbmcoY2xhc3NOYW1lKS50cmltKCkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG5ld0NsYXNzZXMgPSBjbGVhbkNsYXNzTmFtZShbXSwgY2xhc3NlcyksXG4gICAgICAgICAgICBjdXJyZW50Q2xhc3NlcyA9IGVsZW1lbnQuY2xhc3NOYW1lID8gZWxlbWVudC5jbGFzc05hbWUuc3BsaXQoJyAnKSA6IFtdO1xuXG4gICAgICAgIGxhc3RDbGFzc2VzLm1hcChmdW5jdGlvbihjbGFzc05hbWUpe1xuICAgICAgICAgICAgaWYoIWNsYXNzTmFtZSl7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgaW5kZXggPSBjdXJyZW50Q2xhc3Nlcy5pbmRleE9mKGNsYXNzTmFtZSk7XG5cbiAgICAgICAgICAgIGlmKH5pbmRleCl7XG4gICAgICAgICAgICAgICAgY3VycmVudENsYXNzZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgY3VycmVudENsYXNzZXMgPSBjdXJyZW50Q2xhc3Nlcy5jb25jYXQobmV3Q2xhc3Nlcyk7XG4gICAgICAgIGxhc3RDbGFzc2VzID0gbmV3Q2xhc3NlcztcblxuICAgICAgICBlbGVtZW50LmNsYXNzTmFtZSA9IGN1cnJlbnRDbGFzc2VzLmpvaW4oJyAnKTtcbiAgICB9O1xufTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG5mdW5jdGlvbiB0b0FycmF5KGl0ZW1zKXtcbiAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoaXRlbXMpO1xufVxuXG52YXIgZGVlcFJlZ2V4ID0gL1t8Ll0vaTtcblxuZnVuY3Rpb24gbWF0Y2hEZWVwKHBhdGgpe1xuICAgIHJldHVybiAocGF0aCArICcnKS5tYXRjaChkZWVwUmVnZXgpO1xufVxuXG5mdW5jdGlvbiBpc1dpbGRjYXJkUGF0aChwYXRoKXtcbiAgICB2YXIgc3RyaW5nUGF0aCA9IChwYXRoICsgJycpO1xuICAgIHJldHVybiB+c3RyaW5nUGF0aC5pbmRleE9mKCcqJyk7XG59XG5cbmZ1bmN0aW9uIGdldFRhcmdldEtleShwYXRoKXtcbiAgICB2YXIgc3RyaW5nUGF0aCA9IChwYXRoICsgJycpO1xuICAgIHJldHVybiBzdHJpbmdQYXRoLnNwbGl0KCd8Jykuc2hpZnQoKTtcbn1cblxudmFyIGV2ZW50U3lzdGVtVmVyc2lvbiA9IDEsXG4gICAgZ2xvYmFsS2V5ID0gJ19lbnRpRXZlbnRTdGF0ZScgKyBldmVudFN5c3RlbVZlcnNpb25cbiAgICBnbG9iYWxTdGF0ZSA9IGdsb2JhbFtnbG9iYWxLZXldID0gZ2xvYmFsW2dsb2JhbEtleV0gfHwge1xuICAgICAgICBpbnN0YW5jZXM6IFtdXG4gICAgfTtcblxudmFyIG1vZGlmaWVkRW50aWVzID0gZ2xvYmFsU3RhdGUubW9kaWZpZWRFbnRpZXMgPSBnbG9iYWxTdGF0ZS5tb2RpZmllZEVudGllcyB8fCBuZXcgU2V0KCksXG4gICAgdHJhY2tlZE9iamVjdHMgPSBnbG9iYWxTdGF0ZS50cmFja2VkT2JqZWN0cyA9IGdsb2JhbFN0YXRlLnRyYWNrZWRPYmplY3RzIHx8IG5ldyBXZWFrTWFwKCk7XG5cbmZ1bmN0aW9uIGxlZnRBbmRSZXN0KHBhdGgpe1xuICAgIHZhciBzdHJpbmdQYXRoID0gKHBhdGggKyAnJyk7XG5cbiAgICAvLyBTcGVjaWFsIGNhc2Ugd2hlbiB5b3Ugd2FudCB0byBmaWx0ZXIgb24gc2VsZiAoLilcbiAgICBpZihzdHJpbmdQYXRoLnNsaWNlKDAsMikgPT09ICcufCcpe1xuICAgICAgICByZXR1cm4gWycuJywgc3RyaW5nUGF0aC5zbGljZSgyKV07XG4gICAgfVxuXG4gICAgdmFyIG1hdGNoID0gbWF0Y2hEZWVwKHN0cmluZ1BhdGgpO1xuICAgIGlmKG1hdGNoKXtcbiAgICAgICAgcmV0dXJuIFtzdHJpbmdQYXRoLnNsaWNlKDAsIG1hdGNoLmluZGV4KSwgc3RyaW5nUGF0aC5zbGljZShtYXRjaC5pbmRleCsxKV07XG4gICAgfVxuICAgIHJldHVybiBzdHJpbmdQYXRoO1xufVxuXG5mdW5jdGlvbiBpc1dpbGRjYXJkS2V5KGtleSl7XG4gICAgcmV0dXJuIGtleS5jaGFyQXQoMCkgPT09ICcqJztcbn1cblxuZnVuY3Rpb24gaXNGZXJhbGNhcmRLZXkoa2V5KXtcbiAgICByZXR1cm4ga2V5ID09PSAnKionO1xufVxuXG5mdW5jdGlvbiBhZGRIYW5kbGVyKG9iamVjdCwga2V5LCBoYW5kbGVyKXtcbiAgICB2YXIgdHJhY2tlZEtleXMgPSB0cmFja2VkT2JqZWN0cy5nZXQob2JqZWN0KTtcblxuICAgIGlmKHRyYWNrZWRLZXlzID09IG51bGwpe1xuICAgICAgICB0cmFja2VkS2V5cyA9IHt9O1xuICAgICAgICB0cmFja2VkT2JqZWN0cy5zZXQob2JqZWN0LCB0cmFja2VkS2V5cyk7XG4gICAgfVxuXG4gICAgdmFyIGhhbmRsZXJzID0gdHJhY2tlZEtleXNba2V5XTtcblxuICAgIGlmKCFoYW5kbGVycyl7XG4gICAgICAgIGhhbmRsZXJzID0gbmV3IFNldCgpO1xuICAgICAgICB0cmFja2VkS2V5c1trZXldID0gaGFuZGxlcnM7XG4gICAgfVxuXG4gICAgaGFuZGxlcnMuYWRkKGhhbmRsZXIpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVIYW5kbGVyKG9iamVjdCwga2V5LCBoYW5kbGVyKXtcbiAgICB2YXIgdHJhY2tlZEtleXMgPSB0cmFja2VkT2JqZWN0cy5nZXQob2JqZWN0KTtcblxuICAgIGlmKHRyYWNrZWRLZXlzID09IG51bGwpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGhhbmRsZXJzID0gdHJhY2tlZEtleXNba2V5XTtcblxuICAgIGlmKCFoYW5kbGVycyl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBoYW5kbGVycy5kZWxldGUoaGFuZGxlcik7XG59XG5cbmZ1bmN0aW9uIHRyYWNrT2JqZWN0cyhldmVudE5hbWUsIHdlYWtNYXAsIGhhbmRsZXIsIG9iamVjdCwga2V5LCBwYXRoKXtcbiAgICBpZighb2JqZWN0IHx8IHR5cGVvZiBvYmplY3QgIT09ICdvYmplY3QnKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBldmVudEtleSA9IGtleSA9PT0gJyoqJyA/ICcqJyA6IGtleSxcbiAgICAgICAgdGFyZ2V0ID0gb2JqZWN0W2tleV0sXG4gICAgICAgIHRhcmdldElzT2JqZWN0ID0gdGFyZ2V0ICYmIHR5cGVvZiB0YXJnZXQgPT09ICdvYmplY3QnO1xuXG4gICAgaWYodGFyZ2V0SXNPYmplY3QgJiYgd2Vha01hcC5oYXModGFyZ2V0KSl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgaGFuZGxlID0gZnVuY3Rpb24odmFsdWUsIGV2ZW50LCBlbWl0S2V5KXtcbiAgICAgICAgaWYoZXZlbnRLZXkgIT09ICcqJyAmJiB0eXBlb2Ygb2JqZWN0W2V2ZW50S2V5XSA9PT0gJ29iamVjdCcgJiYgb2JqZWN0W2V2ZW50S2V5XSAhPT0gdGFyZ2V0KXtcbiAgICAgICAgICAgIGlmKHRhcmdldElzT2JqZWN0KXtcbiAgICAgICAgICAgICAgICB3ZWFrTWFwLmRlbGV0ZSh0YXJnZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVtb3ZlSGFuZGxlcihvYmplY3QsIGV2ZW50S2V5LCBoYW5kbGUpO1xuICAgICAgICAgICAgdHJhY2tPYmplY3RzKGV2ZW50TmFtZSwgd2Vha01hcCwgaGFuZGxlciwgb2JqZWN0LCBrZXksIHBhdGgpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoZXZlbnRLZXkgPT09ICcqJyl7XG4gICAgICAgICAgICB0cmFja0tleXMob2JqZWN0LCBrZXksIHBhdGgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoIXdlYWtNYXAuaGFzKG9iamVjdCkpe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoa2V5ICE9PSAnKionIHx8ICFwYXRoKXtcbiAgICAgICAgICAgIGhhbmRsZXIodmFsdWUsIGV2ZW50LCBlbWl0S2V5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRyYWNrS2V5cyh0YXJnZXQsIHJvb3QsIHJlc3Qpe1xuICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHRhcmdldCk7XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgIGlmKGlzRmVyYWxjYXJkS2V5KHJvb3QpKXtcbiAgICAgICAgICAgICAgICB0cmFja09iamVjdHMoZXZlbnROYW1lLCB3ZWFrTWFwLCBoYW5kbGVyLCB0YXJnZXQsIGtleXNbaV0sICcqKicgKyAocmVzdCA/ICcuJyA6ICcnKSArIChyZXN0IHx8ICcnKSk7XG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICB0cmFja09iamVjdHMoZXZlbnROYW1lLCB3ZWFrTWFwLCBoYW5kbGVyLCB0YXJnZXQsIGtleXNbaV0sIHJlc3QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkSGFuZGxlcihvYmplY3QsIGV2ZW50S2V5LCBoYW5kbGUpO1xuXG4gICAgaWYoIXRhcmdldElzT2JqZWN0KXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFRoaXMgd291bGQgb2J2aW91c2x5IGJlIGJldHRlciBpbXBsZW1lbnRlZCB3aXRoIGEgV2Vha1NldCxcbiAgICAvLyBCdXQgSSdtIHRyeWluZyB0byBrZWVwIGZpbGVzaXplIGRvd24sIGFuZCBJIGRvbid0IHJlYWxseSB3YW50IGFub3RoZXJcbiAgICAvLyBwb2x5ZmlsbCB3aGVuIFdlYWtNYXAgd29ya3Mgd2VsbCBlbm91Z2ggZm9yIHRoZSB0YXNrLlxuICAgIHdlYWtNYXAuc2V0KHRhcmdldCwgbnVsbCk7XG5cbiAgICBpZighcGF0aCl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgcm9vdEFuZFJlc3QgPSBsZWZ0QW5kUmVzdChwYXRoKSxcbiAgICAgICAgcm9vdCxcbiAgICAgICAgcmVzdDtcblxuICAgIGlmKCFBcnJheS5pc0FycmF5KHJvb3RBbmRSZXN0KSl7XG4gICAgICAgIHJvb3QgPSByb290QW5kUmVzdDtcbiAgICB9ZWxzZXtcbiAgICAgICAgcm9vdCA9IHJvb3RBbmRSZXN0WzBdO1xuICAgICAgICByZXN0ID0gcm9vdEFuZFJlc3RbMV07XG5cbiAgICAgICAgLy8gSWYgdGhlIHJvb3QgaXMgJy4nLCB3YXRjaCBmb3IgZXZlbnRzIG9uICpcbiAgICAgICAgaWYocm9vdCA9PT0gJy4nKXtcbiAgICAgICAgICAgIHJvb3QgPSAnKic7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZih0YXJnZXRJc09iamVjdCAmJiBpc1dpbGRjYXJkS2V5KHJvb3QpKXtcbiAgICAgICAgdHJhY2tLZXlzKHRhcmdldCwgcm9vdCwgcmVzdCk7XG4gICAgfVxuXG4gICAgdHJhY2tPYmplY3RzKGV2ZW50TmFtZSwgd2Vha01hcCwgaGFuZGxlciwgdGFyZ2V0LCByb290LCByZXN0KTtcbn1cblxudmFyIHRyYWNrZWRFdmVudHMgPSBuZXcgV2Vha01hcCgpO1xuZnVuY3Rpb24gY3JlYXRlSGFuZGxlcihlbnRpLCB0cmFja2VkT2JqZWN0UGF0aHMsIHRyYWNrZWRQYXRocywgZXZlbnROYW1lKXtcbiAgICB2YXIgb2xkTW9kZWwgPSBlbnRpLl9tb2RlbDtcbiAgICByZXR1cm4gZnVuY3Rpb24oZXZlbnQsIGVtaXRLZXkpe1xuICAgICAgICB0cmFja2VkUGF0aHMuZW50aXMuZm9yRWFjaChmdW5jdGlvbihlbnRpKXtcbiAgICAgICAgICAgIGlmKGVudGkuX2VtaXR0ZWRFdmVudHNbZXZlbnROYW1lXSA9PT0gZW1pdEtleSl7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihlbnRpLl9tb2RlbCAhPT0gb2xkTW9kZWwpe1xuICAgICAgICAgICAgICAgIHRyYWNrZWRQYXRocy5lbnRpcy5kZWxldGUoZW50aSk7XG4gICAgICAgICAgICAgICAgaWYodHJhY2tlZFBhdGhzLmVudGlzLnNpemUgPT09IDApe1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgdHJhY2tlZE9iamVjdFBhdGhzW2V2ZW50TmFtZV07XG4gICAgICAgICAgICAgICAgICAgIGlmKCFPYmplY3Qua2V5cyh0cmFja2VkT2JqZWN0UGF0aHMpLmxlbmd0aCl7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFja2VkRXZlbnRzLmRlbGV0ZShvbGRNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBlbnRpLl9lbWl0dGVkRXZlbnRzW2V2ZW50TmFtZV0gPSBlbWl0S2V5O1xuXG4gICAgICAgICAgICB2YXIgdGFyZ2V0S2V5ID0gZ2V0VGFyZ2V0S2V5KGV2ZW50TmFtZSksXG4gICAgICAgICAgICAgICAgdmFsdWUgPSBpc1dpbGRjYXJkUGF0aCh0YXJnZXRLZXkpID8gdW5kZWZpbmVkIDogZW50aS5nZXQodGFyZ2V0S2V5KTtcblxuICAgICAgICAgICAgZW50aS5lbWl0KGV2ZW50TmFtZSwgdmFsdWUsIGV2ZW50KTtcbiAgICAgICAgfSk7XG4gICAgfTtcbn1cblxuZnVuY3Rpb24gdHJhY2tQYXRoKGVudGksIGV2ZW50TmFtZSl7XG4gICAgdmFyIG9iamVjdCA9IGVudGkuX21vZGVsLFxuICAgICAgICB0cmFja2VkT2JqZWN0UGF0aHMgPSB0cmFja2VkRXZlbnRzLmdldChvYmplY3QpO1xuXG4gICAgaWYoIXRyYWNrZWRPYmplY3RQYXRocyl7XG4gICAgICAgIHRyYWNrZWRPYmplY3RQYXRocyA9IHt9O1xuICAgICAgICB0cmFja2VkRXZlbnRzLnNldChvYmplY3QsIHRyYWNrZWRPYmplY3RQYXRocyk7XG4gICAgfVxuXG4gICAgdmFyIHRyYWNrZWRQYXRocyA9IHRyYWNrZWRPYmplY3RQYXRoc1tldmVudE5hbWVdO1xuXG4gICAgaWYoIXRyYWNrZWRQYXRocyl7XG4gICAgICAgIHRyYWNrZWRQYXRocyA9IHtcbiAgICAgICAgICAgIGVudGlzOiBuZXcgU2V0KCksXG4gICAgICAgICAgICB0cmFja2VkT2JqZWN0czogbmV3IFdlYWtNYXAoKVxuICAgICAgICB9O1xuICAgICAgICB0cmFja2VkT2JqZWN0UGF0aHNbZXZlbnROYW1lXSA9IHRyYWNrZWRQYXRocztcbiAgICB9ZWxzZSBpZih0cmFja2VkUGF0aHMuZW50aXMuaGFzKGVudGkpKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRyYWNrZWRQYXRocy5lbnRpcy5hZGQoZW50aSk7XG5cbiAgICB2YXIgaGFuZGxlciA9IGNyZWF0ZUhhbmRsZXIoZW50aSwgdHJhY2tlZE9iamVjdFBhdGhzLCB0cmFja2VkUGF0aHMsIGV2ZW50TmFtZSk7XG5cbiAgICB0cmFja09iamVjdHMoZXZlbnROYW1lLCB0cmFja2VkUGF0aHMudHJhY2tlZE9iamVjdHMsIGhhbmRsZXIsIHttb2RlbDpvYmplY3R9LCAnbW9kZWwnLCBldmVudE5hbWUpO1xufVxuXG5mdW5jdGlvbiB0cmFja1BhdGhzKGVudGkpe1xuICAgIGlmKCFlbnRpLl9ldmVudHMgfHwgIWVudGkuX21vZGVsKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGZvcih2YXIga2V5IGluIGVudGkuX2V2ZW50cyl7XG4gICAgICAgIHRyYWNrUGF0aChlbnRpLCBrZXkpO1xuICAgIH1cbiAgICBtb2RpZmllZEVudGllcy5kZWxldGUoZW50aSk7XG59XG5cbmZ1bmN0aW9uIGVtaXRFdmVudChvYmplY3QsIGtleSwgdmFsdWUsIGVtaXRLZXkpe1xuXG4gICAgbW9kaWZpZWRFbnRpZXMuZm9yRWFjaCh0cmFja1BhdGhzKTtcblxuICAgIHZhciB0cmFja2VkS2V5cyA9IHRyYWNrZWRPYmplY3RzLmdldChvYmplY3QpO1xuXG4gICAgaWYoIXRyYWNrZWRLZXlzKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBldmVudCA9IHtcbiAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICBrZXk6IGtleSxcbiAgICAgICAgb2JqZWN0OiBvYmplY3RcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gZW1pdEZvcktleShoYW5kbGVyKXtcbiAgICAgICAgaGFuZGxlcihldmVudCwgZW1pdEtleSk7XG4gICAgfVxuXG4gICAgaWYodHJhY2tlZEtleXNba2V5XSl7XG4gICAgICAgIHRyYWNrZWRLZXlzW2tleV0uZm9yRWFjaChlbWl0Rm9yS2V5KTtcbiAgICB9XG5cbiAgICBpZih0cmFja2VkS2V5c1snKiddKXtcbiAgICAgICAgdHJhY2tlZEtleXNbJyonXS5mb3JFYWNoKGVtaXRGb3JLZXkpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZW1pdChldmVudHMpe1xuICAgIHZhciBlbWl0S2V5ID0ge307XG4gICAgZXZlbnRzLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpe1xuICAgICAgICBlbWl0RXZlbnQoZXZlbnRbMF0sIGV2ZW50WzFdLCBldmVudFsyXSwgZW1pdEtleSk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIEVudGkobW9kZWwpe1xuICAgIHZhciBkZXRhY2hlZCA9IG1vZGVsID09PSBmYWxzZTtcblxuICAgIGlmKCFtb2RlbCB8fCAodHlwZW9mIG1vZGVsICE9PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kZWwgIT09ICdmdW5jdGlvbicpKXtcbiAgICAgICAgbW9kZWwgPSB7fTtcbiAgICB9XG5cbiAgICB0aGlzLl9lbWl0dGVkRXZlbnRzID0ge307XG4gICAgaWYoZGV0YWNoZWQpe1xuICAgICAgICB0aGlzLl9tb2RlbCA9IHt9O1xuICAgIH1lbHNle1xuICAgICAgICB0aGlzLmF0dGFjaChtb2RlbCk7XG4gICAgfVxuXG4gICAgdGhpcy5vbignbmV3TGlzdGVuZXInLCBmdW5jdGlvbigpe1xuICAgICAgICBtb2RpZmllZEVudGllcy5hZGQodGhpcyk7XG4gICAgfSk7XG59XG5FbnRpLmdldCA9IGZ1bmN0aW9uKG1vZGVsLCBrZXkpe1xuICAgIGlmKCFtb2RlbCB8fCB0eXBlb2YgbW9kZWwgIT09ICdvYmplY3QnKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGtleSA9IGdldFRhcmdldEtleShrZXkpO1xuXG4gICAgaWYoa2V5ID09PSAnLicpe1xuICAgICAgICByZXR1cm4gbW9kZWw7XG4gICAgfVxuXG5cbiAgICB2YXIgcGF0aCA9IGxlZnRBbmRSZXN0KGtleSk7XG4gICAgaWYoQXJyYXkuaXNBcnJheShwYXRoKSl7XG4gICAgICAgIHJldHVybiBFbnRpLmdldChtb2RlbFtwYXRoWzBdXSwgcGF0aFsxXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1vZGVsW2tleV07XG59O1xuRW50aS5zZXQgPSBmdW5jdGlvbihtb2RlbCwga2V5LCB2YWx1ZSl7XG4gICAgaWYoIW1vZGVsIHx8IHR5cGVvZiBtb2RlbCAhPT0gJ29iamVjdCcpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAga2V5ID0gZ2V0VGFyZ2V0S2V5KGtleSk7XG5cbiAgICB2YXIgcGF0aCA9IGxlZnRBbmRSZXN0KGtleSk7XG4gICAgaWYoQXJyYXkuaXNBcnJheShwYXRoKSl7XG4gICAgICAgIHJldHVybiBFbnRpLnNldChtb2RlbFtwYXRoWzBdXSwgcGF0aFsxXSwgdmFsdWUpO1xuICAgIH1cblxuICAgIHZhciBvcmlnaW5hbCA9IG1vZGVsW2tleV07XG5cbiAgICBpZih0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnICYmIHZhbHVlID09PSBvcmlnaW5hbCl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIga2V5c0NoYW5nZWQgPSAhKGtleSBpbiBtb2RlbCk7XG5cbiAgICBtb2RlbFtrZXldID0gdmFsdWU7XG5cbiAgICB2YXIgZXZlbnRzID0gW1ttb2RlbCwga2V5LCB2YWx1ZV1dO1xuXG4gICAgaWYoa2V5c0NoYW5nZWQpe1xuICAgICAgICBpZihBcnJheS5pc0FycmF5KG1vZGVsKSl7XG4gICAgICAgICAgICBldmVudHMucHVzaChbbW9kZWwsICdsZW5ndGgnLCBtb2RlbC5sZW5ndGhdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGVtaXQoZXZlbnRzKTtcbn07XG5FbnRpLnB1c2ggPSBmdW5jdGlvbihtb2RlbCwga2V5LCB2YWx1ZSl7XG4gICAgaWYoIW1vZGVsIHx8IHR5cGVvZiBtb2RlbCAhPT0gJ29iamVjdCcpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHRhcmdldDtcbiAgICBpZihhcmd1bWVudHMubGVuZ3RoIDwgMyl7XG4gICAgICAgIHZhbHVlID0ga2V5O1xuICAgICAgICBrZXkgPSAnLic7XG4gICAgICAgIHRhcmdldCA9IG1vZGVsO1xuICAgIH1lbHNle1xuICAgICAgICB2YXIgcGF0aCA9IGxlZnRBbmRSZXN0KGtleSk7XG4gICAgICAgIGlmKEFycmF5LmlzQXJyYXkocGF0aCkpe1xuICAgICAgICAgICAgcmV0dXJuIEVudGkucHVzaChtb2RlbFtwYXRoWzBdXSwgcGF0aFsxXSwgdmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGFyZ2V0ID0gbW9kZWxba2V5XTtcbiAgICB9XG5cbiAgICBpZighQXJyYXkuaXNBcnJheSh0YXJnZXQpKXtcbiAgICAgICAgdGhyb3cgJ1RoZSB0YXJnZXQgaXMgbm90IGFuIGFycmF5Lic7XG4gICAgfVxuXG4gICAgdGFyZ2V0LnB1c2godmFsdWUpO1xuXG4gICAgdmFyIGV2ZW50cyA9IFtcbiAgICAgICAgW3RhcmdldCwgdGFyZ2V0Lmxlbmd0aC0xLCB2YWx1ZV0sXG4gICAgICAgIFt0YXJnZXQsICdsZW5ndGgnLCB0YXJnZXQubGVuZ3RoXVxuICAgIF07XG5cbiAgICBlbWl0KGV2ZW50cyk7XG59O1xuRW50aS5pbnNlcnQgPSBmdW5jdGlvbihtb2RlbCwga2V5LCB2YWx1ZSwgaW5kZXgpe1xuICAgIGlmKCFtb2RlbCB8fCB0eXBlb2YgbW9kZWwgIT09ICdvYmplY3QnKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuXG4gICAgdmFyIHRhcmdldDtcbiAgICBpZihhcmd1bWVudHMubGVuZ3RoIDwgNCl7XG4gICAgICAgIGluZGV4ID0gdmFsdWU7XG4gICAgICAgIHZhbHVlID0ga2V5O1xuICAgICAgICBrZXkgPSAnLic7XG4gICAgICAgIHRhcmdldCA9IG1vZGVsO1xuICAgIH1lbHNle1xuICAgICAgICB2YXIgcGF0aCA9IGxlZnRBbmRSZXN0KGtleSk7XG4gICAgICAgIGlmKEFycmF5LmlzQXJyYXkocGF0aCkpe1xuICAgICAgICAgICAgcmV0dXJuIEVudGkuaW5zZXJ0KG1vZGVsW3BhdGhbMF1dLCBwYXRoWzFdLCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGFyZ2V0ID0gbW9kZWxba2V5XTtcbiAgICB9XG5cbiAgICBpZighQXJyYXkuaXNBcnJheSh0YXJnZXQpKXtcbiAgICAgICAgdGhyb3cgJ1RoZSB0YXJnZXQgaXMgbm90IGFuIGFycmF5Lic7XG4gICAgfVxuXG4gICAgdGFyZ2V0LnNwbGljZShpbmRleCwgMCwgdmFsdWUpO1xuXG4gICAgdmFyIGV2ZW50cyA9IFtcbiAgICAgICAgW3RhcmdldCwgaW5kZXgsIHZhbHVlXSxcbiAgICAgICAgW3RhcmdldCwgJ2xlbmd0aCcsIHRhcmdldC5sZW5ndGhdXG4gICAgXTtcblxuICAgIGVtaXQoZXZlbnRzKTtcbn07XG5FbnRpLnJlbW92ZSA9IGZ1bmN0aW9uKG1vZGVsLCBrZXksIHN1YktleSl7XG4gICAgaWYoIW1vZGVsIHx8IHR5cGVvZiBtb2RlbCAhPT0gJ29iamVjdCcpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHBhdGggPSBsZWZ0QW5kUmVzdChrZXkpO1xuICAgIGlmKEFycmF5LmlzQXJyYXkocGF0aCkpe1xuICAgICAgICByZXR1cm4gRW50aS5yZW1vdmUobW9kZWxbcGF0aFswXV0sIHBhdGhbMV0sIHN1YktleSk7XG4gICAgfVxuXG4gICAgLy8gUmVtb3ZlIGEga2V5IG9mZiBvZiBhbiBvYmplY3QgYXQgJ2tleSdcbiAgICBpZihzdWJLZXkgIT0gbnVsbCl7XG4gICAgICAgIEVudGkucmVtb3ZlKG1vZGVsW2tleV0sIHN1YktleSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZihrZXkgPT09ICcuJyl7XG4gICAgICAgIHRocm93ICcuIChzZWxmKSBpcyBub3QgYSB2YWxpZCBrZXkgdG8gcmVtb3ZlJztcbiAgICB9XG5cbiAgICB2YXIgZXZlbnRzID0gW107XG5cbiAgICBpZihBcnJheS5pc0FycmF5KG1vZGVsKSl7XG4gICAgICAgIG1vZGVsLnNwbGljZShrZXksIDEpO1xuICAgICAgICBldmVudHMucHVzaChbbW9kZWwsICdsZW5ndGgnLCBtb2RlbC5sZW5ndGhdKTtcbiAgICB9ZWxzZXtcbiAgICAgICAgZGVsZXRlIG1vZGVsW2tleV07XG4gICAgICAgIGV2ZW50cy5wdXNoKFttb2RlbCwga2V5XSk7XG4gICAgfVxuXG4gICAgZW1pdChldmVudHMpO1xufTtcbkVudGkubW92ZSA9IGZ1bmN0aW9uKG1vZGVsLCBrZXksIGluZGV4KXtcbiAgICBpZighbW9kZWwgfHwgdHlwZW9mIG1vZGVsICE9PSAnb2JqZWN0Jyl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgcGF0aCA9IGxlZnRBbmRSZXN0KGtleSk7XG4gICAgaWYoQXJyYXkuaXNBcnJheShwYXRoKSl7XG4gICAgICAgIHJldHVybiBFbnRpLm1vdmUobW9kZWxbcGF0aFswXV0sIHBhdGhbMV0sIGluZGV4KTtcbiAgICB9XG5cbiAgICBpZihrZXkgPT09IGluZGV4KXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmKCFBcnJheS5pc0FycmF5KG1vZGVsKSl7XG4gICAgICAgIHRocm93ICdUaGUgbW9kZWwgaXMgbm90IGFuIGFycmF5Lic7XG4gICAgfVxuXG4gICAgdmFyIGl0ZW0gPSBtb2RlbFtrZXldO1xuXG4gICAgbW9kZWwuc3BsaWNlKGtleSwgMSk7XG5cbiAgICBtb2RlbC5zcGxpY2UoaW5kZXggLSAoaW5kZXggPiBrZXkgPyAwIDogMSksIDAsIGl0ZW0pO1xuXG4gICAgZW1pdChbW21vZGVsLCBpbmRleCwgaXRlbV1dKTtcbn07XG5FbnRpLnVwZGF0ZSA9IGZ1bmN0aW9uKG1vZGVsLCBrZXksIHZhbHVlKXtcbiAgICBpZighbW9kZWwgfHwgdHlwZW9mIG1vZGVsICE9PSAnb2JqZWN0Jyl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgdGFyZ2V0LFxuICAgICAgICBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSh2YWx1ZSk7XG5cbiAgICBpZihhcmd1bWVudHMubGVuZ3RoIDwgMyl7XG4gICAgICAgIHZhbHVlID0ga2V5O1xuICAgICAgICBrZXkgPSAnLic7XG4gICAgICAgIHRhcmdldCA9IG1vZGVsO1xuICAgIH1lbHNle1xuICAgICAgICB2YXIgcGF0aCA9IGxlZnRBbmRSZXN0KGtleSk7XG4gICAgICAgIGlmKEFycmF5LmlzQXJyYXkocGF0aCkpe1xuICAgICAgICAgICAgcmV0dXJuIEVudGkudXBkYXRlKG1vZGVsW3BhdGhbMF1dLCBwYXRoWzFdLCB2YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0YXJnZXQgPSBtb2RlbFtrZXldO1xuXG4gICAgICAgIGlmKHRhcmdldCA9PSBudWxsKXtcbiAgICAgICAgICAgIG1vZGVsW2tleV0gPSBpc0FycmF5ID8gW10gOiB7fTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmKHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpe1xuICAgICAgICB0aHJvdyAnVGhlIHZhbHVlIGlzIG5vdCBhbiBvYmplY3QuJztcbiAgICB9XG5cbiAgICBpZih0eXBlb2YgdGFyZ2V0ICE9PSAnb2JqZWN0Jyl7XG4gICAgICAgIHRocm93ICdUaGUgdGFyZ2V0IGlzIG5vdCBhbiBvYmplY3QuJztcbiAgICB9XG5cbiAgICB2YXIgZXZlbnRzID0gW107XG5cbiAgICBmdW5jdGlvbiB1cGRhdGVUYXJnZXQodGFyZ2V0LCB2YWx1ZSl7XG4gICAgICAgIGZvcih2YXIga2V5IGluIHZhbHVlKXtcbiAgICAgICAgICAgIGlmKHRhcmdldFtrZXldICYmIHR5cGVvZiB0YXJnZXRba2V5XSA9PT0gJ29iamVjdCcpe1xuICAgICAgICAgICAgICAgIHVwZGF0ZVRhcmdldCh0YXJnZXRba2V5XSwgdmFsdWVba2V5XSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0YXJnZXRba2V5XSA9IHZhbHVlW2tleV07XG4gICAgICAgICAgICBldmVudHMucHVzaChbdGFyZ2V0LCBrZXksIHZhbHVlW2tleV1dKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKEFycmF5LmlzQXJyYXkodGFyZ2V0KSl7XG4gICAgICAgICAgICBldmVudHMucHVzaChbdGFyZ2V0LCAnbGVuZ3RoJywgdGFyZ2V0Lmxlbmd0aF0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlVGFyZ2V0KHRhcmdldCwgdmFsdWUpO1xuXG4gICAgZW1pdChldmVudHMpO1xufTtcbkVudGkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcbkVudGkucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSAxMDA7XG5FbnRpLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEVudGk7XG5FbnRpLnByb3RvdHlwZS5hdHRhY2ggPSBmdW5jdGlvbihtb2RlbCl7XG4gICAgaWYodGhpcy5fbW9kZWwgIT09IG1vZGVsKXtcbiAgICAgICAgdGhpcy5kZXRhY2goKTtcbiAgICB9XG5cbiAgICBtb2RpZmllZEVudGllcy5hZGQodGhpcyk7XG4gICAgdGhpcy5fYXR0YWNoZWQgPSB0cnVlO1xuICAgIHRoaXMuX21vZGVsID0gbW9kZWw7XG4gICAgdGhpcy5lbWl0KCdhdHRhY2gnLCBtb2RlbCk7XG59O1xuRW50aS5wcm90b3R5cGUuZGV0YWNoID0gZnVuY3Rpb24oKXtcbiAgICBtb2RpZmllZEVudGllcy5kZWxldGUodGhpcyk7XG5cbiAgICB0aGlzLl9lbWl0dGVkRXZlbnRzID0ge307XG4gICAgdGhpcy5fbW9kZWwgPSB7fTtcbiAgICB0aGlzLl9hdHRhY2hlZCA9IGZhbHNlO1xuICAgIHRoaXMuZW1pdCgnZGV0YWNoJyk7XG59O1xuRW50aS5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCl7XG4gICAgdGhpcy5kZXRhY2goKTtcbiAgICB0aGlzLl9ldmVudHMgPSBudWxsO1xuICAgIHRoaXMuZW1pdCgnZGVzdHJveScpO1xufTtcbkVudGkucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKGtleSl7XG4gICAgcmV0dXJuIEVudGkuZ2V0KHRoaXMuX21vZGVsLCBrZXkpO1xufTtcblxuRW50aS5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24oa2V5LCB2YWx1ZSl7XG4gICAgcmV0dXJuIEVudGkuc2V0KHRoaXMuX21vZGVsLCBrZXksIHZhbHVlKTtcbn07XG5cbkVudGkucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbihrZXksIHZhbHVlKXtcbiAgICByZXR1cm4gRW50aS5wdXNoLmFwcGx5KG51bGwsIFt0aGlzLl9tb2RlbF0uY29uY2F0KHRvQXJyYXkoYXJndW1lbnRzKSkpO1xufTtcblxuRW50aS5wcm90b3R5cGUuaW5zZXJ0ID0gZnVuY3Rpb24oa2V5LCB2YWx1ZSwgaW5kZXgpe1xuICAgIHJldHVybiBFbnRpLmluc2VydC5hcHBseShudWxsLCBbdGhpcy5fbW9kZWxdLmNvbmNhdCh0b0FycmF5KGFyZ3VtZW50cykpKTtcbn07XG5cbkVudGkucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uKGtleSwgc3ViS2V5KXtcbiAgICByZXR1cm4gRW50aS5yZW1vdmUuYXBwbHkobnVsbCwgW3RoaXMuX21vZGVsXS5jb25jYXQodG9BcnJheShhcmd1bWVudHMpKSk7XG59O1xuXG5FbnRpLnByb3RvdHlwZS5tb3ZlID0gZnVuY3Rpb24oa2V5LCBpbmRleCl7XG4gICAgcmV0dXJuIEVudGkubW92ZS5hcHBseShudWxsLCBbdGhpcy5fbW9kZWxdLmNvbmNhdCh0b0FycmF5KGFyZ3VtZW50cykpKTtcbn07XG5cbkVudGkucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKGtleSwgaW5kZXgpe1xuICAgIHJldHVybiBFbnRpLnVwZGF0ZS5hcHBseShudWxsLCBbdGhpcy5fbW9kZWxdLmNvbmNhdCh0b0FycmF5KGFyZ3VtZW50cykpKTtcbn07XG5FbnRpLnByb3RvdHlwZS5pc0F0dGFjaGVkID0gZnVuY3Rpb24oKXtcbiAgICByZXR1cm4gdGhpcy5fYXR0YWNoZWQ7XG59O1xuRW50aS5wcm90b3R5cGUuYXR0YWNoZWRDb3VudCA9IGZ1bmN0aW9uKCl7XG4gICAgcmV0dXJuIG1vZGlmaWVkRW50aWVzLnNpemU7XG59O1xuXG5FbnRpLmlzRW50aSA9IGZ1bmN0aW9uKHRhcmdldCl7XG4gICAgcmV0dXJuIHRhcmdldCAmJiAhIX5nbG9iYWxTdGF0ZS5pbnN0YW5jZXMuaW5kZXhPZih0YXJnZXQuY29uc3RydWN0b3IpO1xufTtcblxuZ2xvYmFsU3RhdGUuaW5zdGFuY2VzLnB1c2goRW50aSk7XG5cbm1vZHVsZS5leHBvcnRzID0gRW50aTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZmxhdHRlbihsaXN0LCBkZXB0aCkge1xuICBkZXB0aCA9ICh0eXBlb2YgZGVwdGggPT0gJ251bWJlcicpID8gZGVwdGggOiBJbmZpbml0eTtcblxuICByZXR1cm4gX2ZsYXR0ZW4obGlzdCwgMSk7XG5cbiAgZnVuY3Rpb24gX2ZsYXR0ZW4obGlzdCwgZCkge1xuICAgIHJldHVybiBsaXN0LnJlZHVjZShmdW5jdGlvbiAoYWNjLCBpdGVtKSB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShpdGVtKSAmJiBkIDwgZGVwdGgpIHtcbiAgICAgICAgcmV0dXJuIGFjYy5jb25jYXQoX2ZsYXR0ZW4oaXRlbSwgZCArIDEpKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gYWNjLmNvbmNhdChpdGVtKTtcbiAgICAgIH1cbiAgICB9LCBbXSk7XG4gIH1cbn07XG4iLCIndXNlIHN0cmljdCc7XG52YXIgcHJvcElzRW51bWVyYWJsZSA9IE9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGU7XG5cbmZ1bmN0aW9uIFRvT2JqZWN0KHZhbCkge1xuXHRpZiAodmFsID09IG51bGwpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCdPYmplY3QuYXNzaWduIGNhbm5vdCBiZSBjYWxsZWQgd2l0aCBudWxsIG9yIHVuZGVmaW5lZCcpO1xuXHR9XG5cblx0cmV0dXJuIE9iamVjdCh2YWwpO1xufVxuXG5mdW5jdGlvbiBvd25FbnVtZXJhYmxlS2V5cyhvYmopIHtcblx0dmFyIGtleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvYmopO1xuXG5cdGlmIChPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKSB7XG5cdFx0a2V5cyA9IGtleXMuY29uY2F0KE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMob2JqKSk7XG5cdH1cblxuXHRyZXR1cm4ga2V5cy5maWx0ZXIoZnVuY3Rpb24gKGtleSkge1xuXHRcdHJldHVybiBwcm9wSXNFbnVtZXJhYmxlLmNhbGwob2JqLCBrZXkpO1xuXHR9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uICh0YXJnZXQsIHNvdXJjZSkge1xuXHR2YXIgZnJvbTtcblx0dmFyIGtleXM7XG5cdHZhciB0byA9IFRvT2JqZWN0KHRhcmdldCk7XG5cblx0Zm9yICh2YXIgcyA9IDE7IHMgPCBhcmd1bWVudHMubGVuZ3RoOyBzKyspIHtcblx0XHRmcm9tID0gYXJndW1lbnRzW3NdO1xuXHRcdGtleXMgPSBvd25FbnVtZXJhYmxlS2V5cyhPYmplY3QoZnJvbSkpO1xuXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHR0b1trZXlzW2ldXSA9IGZyb21ba2V5c1tpXV07XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHRvO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNTYW1lKGEsIGIpe1xuICAgIGlmKGEgPT09IGIpe1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZihcbiAgICAgICAgdHlwZW9mIGEgIT09IHR5cGVvZiBiIHx8XG4gICAgICAgIHR5cGVvZiBhID09PSAnb2JqZWN0JyAmJlxuICAgICAgICAhKGEgaW5zdGFuY2VvZiBEYXRlICYmIGIgaW5zdGFuY2VvZiBEYXRlKVxuICAgICl7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gU3RyaW5nKGEpID09PSBTdHJpbmcoYik7XG59OyIsInZhciBuYXR1cmFsU2VsZWN0aW9uID0gcmVxdWlyZSgnbmF0dXJhbC1zZWxlY3Rpb24nKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihlbGVtZW50LCB2YWx1ZSl7XG4gICAgdmFyIGNhblNldCA9IG5hdHVyYWxTZWxlY3Rpb24oZWxlbWVudCkgJiYgZWxlbWVudCA9PT0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcblxuICAgIGlmIChjYW5TZXQpIHtcbiAgICAgICAgdmFyIHN0YXJ0ID0gZWxlbWVudC5zZWxlY3Rpb25TdGFydCxcbiAgICAgICAgICAgIGVuZCA9IGVsZW1lbnQuc2VsZWN0aW9uRW5kO1xuXG4gICAgICAgIGVsZW1lbnQudmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgZWxlbWVudC5zZXRTZWxlY3Rpb25SYW5nZShzdGFydCwgZW5kKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBlbGVtZW50LnZhbHVlID0gdmFsdWU7XG4gICAgfVxufTtcbiIsInZhciBzdXBwb3J0ZWRUeXBlcyA9IFsndGV4dCcsICdzZWFyY2gnLCAndGVsJywgJ3VybCcsICdwYXNzd29yZCddO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVsZW1lbnQpe1xuICAgIHJldHVybiAhIShlbGVtZW50LnNldFNlbGVjdGlvblJhbmdlICYmIH5zdXBwb3J0ZWRUeXBlcy5pbmRleE9mKGVsZW1lbnQudHlwZSkpO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gT2JqZWN0LnNldFByb3RvdHlwZU9mIHx8IHtfX3Byb3RvX186W119IGluc3RhbmNlb2YgQXJyYXkgPyBzZXRQcm90b09mIDogbWl4aW5Qcm9wZXJ0aWVzO1xuXG5mdW5jdGlvbiBzZXRQcm90b09mKG9iaiwgcHJvdG8pIHtcblx0b2JqLl9fcHJvdG9fXyA9IHByb3RvO1xufVxuXG5mdW5jdGlvbiBtaXhpblByb3BlcnRpZXMob2JqLCBwcm90bykge1xuXHRmb3IgKHZhciBwcm9wIGluIHByb3RvKSB7XG5cdFx0b2JqW3Byb3BdID0gcHJvdG9bcHJvcF07XG5cdH1cbn1cbiIsInZhciBjbG9uZSA9IHJlcXVpcmUoJ2Nsb25lJyksXG4gICAgZGVlcEVxdWFsID0gcmVxdWlyZSgnZGVlcC1lcXVhbCcpO1xuXG5mdW5jdGlvbiBrZXlzQXJlRGlmZmVyZW50KGtleXMxLCBrZXlzMil7XG4gICAgaWYoa2V5czEgPT09IGtleXMyKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZigha2V5czEgfHwgIWtleXMyIHx8IGtleXMxLmxlbmd0aCAhPT0ga2V5czIubGVuZ3RoKXtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBrZXlzMS5sZW5ndGg7IGkrKyl7XG4gICAgICAgIGlmKCF+a2V5czIuaW5kZXhPZihrZXlzMVtpXSkpe1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldEtleXModmFsdWUpe1xuICAgIGlmKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHJldHVybiBPYmplY3Qua2V5cyh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIFdoYXRDaGFuZ2VkKHZhbHVlLCBjaGFuZ2VzVG9UcmFjayl7XG4gICAgdGhpcy5fY2hhbmdlc1RvVHJhY2sgPSB7fTtcblxuICAgIGlmKGNoYW5nZXNUb1RyYWNrID09IG51bGwpe1xuICAgICAgICBjaGFuZ2VzVG9UcmFjayA9ICd2YWx1ZSB0eXBlIGtleXMgc3RydWN0dXJlIHJlZmVyZW5jZSc7XG4gICAgfVxuXG4gICAgaWYodHlwZW9mIGNoYW5nZXNUb1RyYWNrICE9PSAnc3RyaW5nJyl7XG4gICAgICAgIHRocm93ICdjaGFuZ2VzVG9UcmFjayBtdXN0IGJlIG9mIHR5cGUgc3RyaW5nJztcbiAgICB9XG5cbiAgICBjaGFuZ2VzVG9UcmFjayA9IGNoYW5nZXNUb1RyYWNrLnNwbGl0KCcgJyk7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYW5nZXNUb1RyYWNrLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHRoaXMuX2NoYW5nZXNUb1RyYWNrW2NoYW5nZXNUb1RyYWNrW2ldXSA9IHRydWU7XG4gICAgfTtcblxuICAgIHRoaXMudXBkYXRlKHZhbHVlKTtcbn1cbldoYXRDaGFuZ2VkLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbih2YWx1ZSl7XG4gICAgdmFyIHJlc3VsdCA9IHt9LFxuICAgICAgICBjaGFuZ2VzVG9UcmFjayA9IHRoaXMuX2NoYW5nZXNUb1RyYWNrLFxuICAgICAgICBuZXdLZXlzID0gZ2V0S2V5cyh2YWx1ZSk7XG5cbiAgICBpZigndmFsdWUnIGluIGNoYW5nZXNUb1RyYWNrICYmIHZhbHVlKycnICE9PSB0aGlzLl9sYXN0UmVmZXJlbmNlKycnKXtcbiAgICAgICAgcmVzdWx0LnZhbHVlID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYoXG4gICAgICAgICd0eXBlJyBpbiBjaGFuZ2VzVG9UcmFjayAmJiB0eXBlb2YgdmFsdWUgIT09IHR5cGVvZiB0aGlzLl9sYXN0VmFsdWUgfHxcbiAgICAgICAgKHZhbHVlID09PSBudWxsIHx8IHRoaXMuX2xhc3RWYWx1ZSA9PT0gbnVsbCkgJiYgdGhpcy52YWx1ZSAhPT0gdGhpcy5fbGFzdFZhbHVlIC8vIHR5cGVvZiBudWxsID09PSAnb2JqZWN0J1xuICAgICl7XG4gICAgICAgIHJlc3VsdC50eXBlID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYoJ2tleXMnIGluIGNoYW5nZXNUb1RyYWNrICYmIGtleXNBcmVEaWZmZXJlbnQodGhpcy5fbGFzdEtleXMsIGdldEtleXModmFsdWUpKSl7XG4gICAgICAgIHJlc3VsdC5rZXlzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZih2YWx1ZSAhPT0gbnVsbCAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKXtcbiAgICAgICAgdmFyIGxhc3RWYWx1ZSA9IHRoaXMuX2xhc3RWYWx1ZTtcblxuICAgICAgICBpZignc2hhbGxvd1N0cnVjdHVyZScgaW4gY2hhbmdlc1RvVHJhY2sgJiYgKCFsYXN0VmFsdWUgfHwgdHlwZW9mIGxhc3RWYWx1ZSAhPT0gJ29iamVjdCcgfHwgT2JqZWN0LmtleXModmFsdWUpLnNvbWUoZnVuY3Rpb24oa2V5LCBpbmRleCl7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWVba2V5XSAhPT0gbGFzdFZhbHVlW2tleV07XG4gICAgICAgIH0pKSl7XG4gICAgICAgICAgICByZXN1bHQuc2hhbGxvd1N0cnVjdHVyZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYoJ3N0cnVjdHVyZScgaW4gY2hhbmdlc1RvVHJhY2sgJiYgIWRlZXBFcXVhbCh2YWx1ZSwgbGFzdFZhbHVlKSl7XG4gICAgICAgICAgICByZXN1bHQuc3RydWN0dXJlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZigncmVmZXJlbmNlJyBpbiBjaGFuZ2VzVG9UcmFjayAmJiB2YWx1ZSAhPT0gdGhpcy5fbGFzdFJlZmVyZW5jZSl7XG4gICAgICAgICAgICByZXN1bHQucmVmZXJlbmNlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX2xhc3RWYWx1ZSA9ICdzdHJ1Y3R1cmUnIGluIGNoYW5nZXNUb1RyYWNrID8gY2xvbmUodmFsdWUpIDogJ3NoYWxsb3dTdHJ1Y3R1cmUnIGluIGNoYW5nZXNUb1RyYWNrID8gY2xvbmUodmFsdWUsIHRydWUsIDEpOiB2YWx1ZTtcbiAgICB0aGlzLl9sYXN0UmVmZXJlbmNlID0gdmFsdWU7XG4gICAgdGhpcy5fbGFzdEtleXMgPSBuZXdLZXlzO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gV2hhdENoYW5nZWQ7IiwidmFyIGNsb25lID0gKGZ1bmN0aW9uKCkge1xuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIENsb25lcyAoY29waWVzKSBhbiBPYmplY3QgdXNpbmcgZGVlcCBjb3B5aW5nLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gc3VwcG9ydHMgY2lyY3VsYXIgcmVmZXJlbmNlcyBieSBkZWZhdWx0LCBidXQgaWYgeW91IGFyZSBjZXJ0YWluXG4gKiB0aGVyZSBhcmUgbm8gY2lyY3VsYXIgcmVmZXJlbmNlcyBpbiB5b3VyIG9iamVjdCwgeW91IGNhbiBzYXZlIHNvbWUgQ1BVIHRpbWVcbiAqIGJ5IGNhbGxpbmcgY2xvbmUob2JqLCBmYWxzZSkuXG4gKlxuICogQ2F1dGlvbjogaWYgYGNpcmN1bGFyYCBpcyBmYWxzZSBhbmQgYHBhcmVudGAgY29udGFpbnMgY2lyY3VsYXIgcmVmZXJlbmNlcyxcbiAqIHlvdXIgcHJvZ3JhbSBtYXkgZW50ZXIgYW4gaW5maW5pdGUgbG9vcCBhbmQgY3Jhc2guXG4gKlxuICogQHBhcmFtIGBwYXJlbnRgIC0gdGhlIG9iamVjdCB0byBiZSBjbG9uZWRcbiAqIEBwYXJhbSBgY2lyY3VsYXJgIC0gc2V0IHRvIHRydWUgaWYgdGhlIG9iamVjdCB0byBiZSBjbG9uZWQgbWF5IGNvbnRhaW5cbiAqICAgIGNpcmN1bGFyIHJlZmVyZW5jZXMuIChvcHRpb25hbCAtIHRydWUgYnkgZGVmYXVsdClcbiAqIEBwYXJhbSBgZGVwdGhgIC0gc2V0IHRvIGEgbnVtYmVyIGlmIHRoZSBvYmplY3QgaXMgb25seSB0byBiZSBjbG9uZWQgdG9cbiAqICAgIGEgcGFydGljdWxhciBkZXB0aC4gKG9wdGlvbmFsIC0gZGVmYXVsdHMgdG8gSW5maW5pdHkpXG4gKiBAcGFyYW0gYHByb3RvdHlwZWAgLSBzZXRzIHRoZSBwcm90b3R5cGUgdG8gYmUgdXNlZCB3aGVuIGNsb25pbmcgYW4gb2JqZWN0LlxuICogICAgKG9wdGlvbmFsIC0gZGVmYXVsdHMgdG8gcGFyZW50IHByb3RvdHlwZSkuXG4qL1xuZnVuY3Rpb24gY2xvbmUocGFyZW50LCBjaXJjdWxhciwgZGVwdGgsIHByb3RvdHlwZSkge1xuICB2YXIgZmlsdGVyO1xuICBpZiAodHlwZW9mIGNpcmN1bGFyID09PSAnb2JqZWN0Jykge1xuICAgIGRlcHRoID0gY2lyY3VsYXIuZGVwdGg7XG4gICAgcHJvdG90eXBlID0gY2lyY3VsYXIucHJvdG90eXBlO1xuICAgIGZpbHRlciA9IGNpcmN1bGFyLmZpbHRlcjtcbiAgICBjaXJjdWxhciA9IGNpcmN1bGFyLmNpcmN1bGFyXG4gIH1cbiAgLy8gbWFpbnRhaW4gdHdvIGFycmF5cyBmb3IgY2lyY3VsYXIgcmVmZXJlbmNlcywgd2hlcmUgY29ycmVzcG9uZGluZyBwYXJlbnRzXG4gIC8vIGFuZCBjaGlsZHJlbiBoYXZlIHRoZSBzYW1lIGluZGV4XG4gIHZhciBhbGxQYXJlbnRzID0gW107XG4gIHZhciBhbGxDaGlsZHJlbiA9IFtdO1xuXG4gIHZhciB1c2VCdWZmZXIgPSB0eXBlb2YgQnVmZmVyICE9ICd1bmRlZmluZWQnO1xuXG4gIGlmICh0eXBlb2YgY2lyY3VsYXIgPT0gJ3VuZGVmaW5lZCcpXG4gICAgY2lyY3VsYXIgPSB0cnVlO1xuXG4gIGlmICh0eXBlb2YgZGVwdGggPT0gJ3VuZGVmaW5lZCcpXG4gICAgZGVwdGggPSBJbmZpbml0eTtcblxuICAvLyByZWN1cnNlIHRoaXMgZnVuY3Rpb24gc28gd2UgZG9uJ3QgcmVzZXQgYWxsUGFyZW50cyBhbmQgYWxsQ2hpbGRyZW5cbiAgZnVuY3Rpb24gX2Nsb25lKHBhcmVudCwgZGVwdGgpIHtcbiAgICAvLyBjbG9uaW5nIG51bGwgYWx3YXlzIHJldHVybnMgbnVsbFxuICAgIGlmIChwYXJlbnQgPT09IG51bGwpXG4gICAgICByZXR1cm4gbnVsbDtcblxuICAgIGlmIChkZXB0aCA9PSAwKVxuICAgICAgcmV0dXJuIHBhcmVudDtcblxuICAgIHZhciBjaGlsZDtcbiAgICB2YXIgcHJvdG87XG4gICAgaWYgKHR5cGVvZiBwYXJlbnQgIT0gJ29iamVjdCcpIHtcbiAgICAgIHJldHVybiBwYXJlbnQ7XG4gICAgfVxuXG4gICAgaWYgKGNsb25lLl9faXNBcnJheShwYXJlbnQpKSB7XG4gICAgICBjaGlsZCA9IFtdO1xuICAgIH0gZWxzZSBpZiAoY2xvbmUuX19pc1JlZ0V4cChwYXJlbnQpKSB7XG4gICAgICBjaGlsZCA9IG5ldyBSZWdFeHAocGFyZW50LnNvdXJjZSwgX19nZXRSZWdFeHBGbGFncyhwYXJlbnQpKTtcbiAgICAgIGlmIChwYXJlbnQubGFzdEluZGV4KSBjaGlsZC5sYXN0SW5kZXggPSBwYXJlbnQubGFzdEluZGV4O1xuICAgIH0gZWxzZSBpZiAoY2xvbmUuX19pc0RhdGUocGFyZW50KSkge1xuICAgICAgY2hpbGQgPSBuZXcgRGF0ZShwYXJlbnQuZ2V0VGltZSgpKTtcbiAgICB9IGVsc2UgaWYgKHVzZUJ1ZmZlciAmJiBCdWZmZXIuaXNCdWZmZXIocGFyZW50KSkge1xuICAgICAgY2hpbGQgPSBuZXcgQnVmZmVyKHBhcmVudC5sZW5ndGgpO1xuICAgICAgcGFyZW50LmNvcHkoY2hpbGQpO1xuICAgICAgcmV0dXJuIGNoaWxkO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodHlwZW9mIHByb3RvdHlwZSA9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBwcm90byA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihwYXJlbnQpO1xuICAgICAgICBjaGlsZCA9IE9iamVjdC5jcmVhdGUocHJvdG8pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNoaWxkID0gT2JqZWN0LmNyZWF0ZShwcm90b3R5cGUpO1xuICAgICAgICBwcm90byA9IHByb3RvdHlwZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY2lyY3VsYXIpIHtcbiAgICAgIHZhciBpbmRleCA9IGFsbFBhcmVudHMuaW5kZXhPZihwYXJlbnQpO1xuXG4gICAgICBpZiAoaW5kZXggIT0gLTEpIHtcbiAgICAgICAgcmV0dXJuIGFsbENoaWxkcmVuW2luZGV4XTtcbiAgICAgIH1cbiAgICAgIGFsbFBhcmVudHMucHVzaChwYXJlbnQpO1xuICAgICAgYWxsQ2hpbGRyZW4ucHVzaChjaGlsZCk7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSBpbiBwYXJlbnQpIHtcbiAgICAgIHZhciBhdHRycztcbiAgICAgIGlmIChwcm90bykge1xuICAgICAgICBhdHRycyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IocHJvdG8sIGkpO1xuICAgICAgfVxuXG4gICAgICBpZiAoYXR0cnMgJiYgYXR0cnMuc2V0ID09IG51bGwpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBjaGlsZFtpXSA9IF9jbG9uZShwYXJlbnRbaV0sIGRlcHRoIC0gMSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNoaWxkO1xuICB9XG5cbiAgcmV0dXJuIF9jbG9uZShwYXJlbnQsIGRlcHRoKTtcbn1cblxuLyoqXG4gKiBTaW1wbGUgZmxhdCBjbG9uZSB1c2luZyBwcm90b3R5cGUsIGFjY2VwdHMgb25seSBvYmplY3RzLCB1c2VmdWxsIGZvciBwcm9wZXJ0eVxuICogb3ZlcnJpZGUgb24gRkxBVCBjb25maWd1cmF0aW9uIG9iamVjdCAobm8gbmVzdGVkIHByb3BzKS5cbiAqXG4gKiBVU0UgV0lUSCBDQVVUSU9OISBUaGlzIG1heSBub3QgYmVoYXZlIGFzIHlvdSB3aXNoIGlmIHlvdSBkbyBub3Qga25vdyBob3cgdGhpc1xuICogd29ya3MuXG4gKi9cbmNsb25lLmNsb25lUHJvdG90eXBlID0gZnVuY3Rpb24gY2xvbmVQcm90b3R5cGUocGFyZW50KSB7XG4gIGlmIChwYXJlbnQgPT09IG51bGwpXG4gICAgcmV0dXJuIG51bGw7XG5cbiAgdmFyIGMgPSBmdW5jdGlvbiAoKSB7fTtcbiAgYy5wcm90b3R5cGUgPSBwYXJlbnQ7XG4gIHJldHVybiBuZXcgYygpO1xufTtcblxuLy8gcHJpdmF0ZSB1dGlsaXR5IGZ1bmN0aW9uc1xuXG5mdW5jdGlvbiBfX29ialRvU3RyKG8pIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKTtcbn07XG5jbG9uZS5fX29ialRvU3RyID0gX19vYmpUb1N0cjtcblxuZnVuY3Rpb24gX19pc0RhdGUobykge1xuICByZXR1cm4gdHlwZW9mIG8gPT09ICdvYmplY3QnICYmIF9fb2JqVG9TdHIobykgPT09ICdbb2JqZWN0IERhdGVdJztcbn07XG5jbG9uZS5fX2lzRGF0ZSA9IF9faXNEYXRlO1xuXG5mdW5jdGlvbiBfX2lzQXJyYXkobykge1xuICByZXR1cm4gdHlwZW9mIG8gPT09ICdvYmplY3QnICYmIF9fb2JqVG9TdHIobykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuY2xvbmUuX19pc0FycmF5ID0gX19pc0FycmF5O1xuXG5mdW5jdGlvbiBfX2lzUmVnRXhwKG8pIHtcbiAgcmV0dXJuIHR5cGVvZiBvID09PSAnb2JqZWN0JyAmJiBfX29ialRvU3RyKG8pID09PSAnW29iamVjdCBSZWdFeHBdJztcbn07XG5jbG9uZS5fX2lzUmVnRXhwID0gX19pc1JlZ0V4cDtcblxuZnVuY3Rpb24gX19nZXRSZWdFeHBGbGFncyhyZSkge1xuICB2YXIgZmxhZ3MgPSAnJztcbiAgaWYgKHJlLmdsb2JhbCkgZmxhZ3MgKz0gJ2cnO1xuICBpZiAocmUuaWdub3JlQ2FzZSkgZmxhZ3MgKz0gJ2knO1xuICBpZiAocmUubXVsdGlsaW5lKSBmbGFncyArPSAnbSc7XG4gIHJldHVybiBmbGFncztcbn07XG5jbG9uZS5fX2dldFJlZ0V4cEZsYWdzID0gX19nZXRSZWdFeHBGbGFncztcblxucmV0dXJuIGNsb25lO1xufSkoKTtcblxuaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gY2xvbmU7XG59XG4iLCJ2YXIgcFNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xudmFyIG9iamVjdEtleXMgPSByZXF1aXJlKCcuL2xpYi9rZXlzLmpzJyk7XG52YXIgaXNBcmd1bWVudHMgPSByZXF1aXJlKCcuL2xpYi9pc19hcmd1bWVudHMuanMnKTtcblxudmFyIGRlZXBFcXVhbCA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG9wdHMpIHtcbiAgaWYgKCFvcHRzKSBvcHRzID0ge307XG4gIC8vIDcuMS4gQWxsIGlkZW50aWNhbCB2YWx1ZXMgYXJlIGVxdWl2YWxlbnQsIGFzIGRldGVybWluZWQgYnkgPT09LlxuICBpZiAoYWN0dWFsID09PSBleHBlY3RlZCkge1xuICAgIHJldHVybiB0cnVlO1xuXG4gIH0gZWxzZSBpZiAoYWN0dWFsIGluc3RhbmNlb2YgRGF0ZSAmJiBleHBlY3RlZCBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICByZXR1cm4gYWN0dWFsLmdldFRpbWUoKSA9PT0gZXhwZWN0ZWQuZ2V0VGltZSgpO1xuXG4gIC8vIDcuMy4gT3RoZXIgcGFpcnMgdGhhdCBkbyBub3QgYm90aCBwYXNzIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JyxcbiAgLy8gZXF1aXZhbGVuY2UgaXMgZGV0ZXJtaW5lZCBieSA9PS5cbiAgfSBlbHNlIGlmICh0eXBlb2YgYWN0dWFsICE9ICdvYmplY3QnICYmIHR5cGVvZiBleHBlY3RlZCAhPSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBvcHRzLnN0cmljdCA/IGFjdHVhbCA9PT0gZXhwZWN0ZWQgOiBhY3R1YWwgPT0gZXhwZWN0ZWQ7XG5cbiAgLy8gNy40LiBGb3IgYWxsIG90aGVyIE9iamVjdCBwYWlycywgaW5jbHVkaW5nIEFycmF5IG9iamVjdHMsIGVxdWl2YWxlbmNlIGlzXG4gIC8vIGRldGVybWluZWQgYnkgaGF2aW5nIHRoZSBzYW1lIG51bWJlciBvZiBvd25lZCBwcm9wZXJ0aWVzIChhcyB2ZXJpZmllZFxuICAvLyB3aXRoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCksIHRoZSBzYW1lIHNldCBvZiBrZXlzXG4gIC8vIChhbHRob3VnaCBub3QgbmVjZXNzYXJpbHkgdGhlIHNhbWUgb3JkZXIpLCBlcXVpdmFsZW50IHZhbHVlcyBmb3IgZXZlcnlcbiAgLy8gY29ycmVzcG9uZGluZyBrZXksIGFuZCBhbiBpZGVudGljYWwgJ3Byb3RvdHlwZScgcHJvcGVydHkuIE5vdGU6IHRoaXNcbiAgLy8gYWNjb3VudHMgZm9yIGJvdGggbmFtZWQgYW5kIGluZGV4ZWQgcHJvcGVydGllcyBvbiBBcnJheXMuXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG9iakVxdWl2KGFjdHVhbCwgZXhwZWN0ZWQsIG9wdHMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkT3JOdWxsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBpc0J1ZmZlciAoeCkge1xuICBpZiAoIXggfHwgdHlwZW9mIHggIT09ICdvYmplY3QnIHx8IHR5cGVvZiB4Lmxlbmd0aCAhPT0gJ251bWJlcicpIHJldHVybiBmYWxzZTtcbiAgaWYgKHR5cGVvZiB4LmNvcHkgIT09ICdmdW5jdGlvbicgfHwgdHlwZW9mIHguc2xpY2UgIT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKHgubGVuZ3RoID4gMCAmJiB0eXBlb2YgeFswXSAhPT0gJ251bWJlcicpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIG9iakVxdWl2KGEsIGIsIG9wdHMpIHtcbiAgdmFyIGksIGtleTtcbiAgaWYgKGlzVW5kZWZpbmVkT3JOdWxsKGEpIHx8IGlzVW5kZWZpbmVkT3JOdWxsKGIpKVxuICAgIHJldHVybiBmYWxzZTtcbiAgLy8gYW4gaWRlbnRpY2FsICdwcm90b3R5cGUnIHByb3BlcnR5LlxuICBpZiAoYS5wcm90b3R5cGUgIT09IGIucHJvdG90eXBlKSByZXR1cm4gZmFsc2U7XG4gIC8vfn5+SSd2ZSBtYW5hZ2VkIHRvIGJyZWFrIE9iamVjdC5rZXlzIHRocm91Z2ggc2NyZXd5IGFyZ3VtZW50cyBwYXNzaW5nLlxuICAvLyAgIENvbnZlcnRpbmcgdG8gYXJyYXkgc29sdmVzIHRoZSBwcm9ibGVtLlxuICBpZiAoaXNBcmd1bWVudHMoYSkpIHtcbiAgICBpZiAoIWlzQXJndW1lbnRzKGIpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGEgPSBwU2xpY2UuY2FsbChhKTtcbiAgICBiID0gcFNsaWNlLmNhbGwoYik7XG4gICAgcmV0dXJuIGRlZXBFcXVhbChhLCBiLCBvcHRzKTtcbiAgfVxuICBpZiAoaXNCdWZmZXIoYSkpIHtcbiAgICBpZiAoIWlzQnVmZmVyKGIpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmIChhLmxlbmd0aCAhPT0gYi5sZW5ndGgpIHJldHVybiBmYWxzZTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgYS5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGFbaV0gIT09IGJbaV0pIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgdHJ5IHtcbiAgICB2YXIga2EgPSBvYmplY3RLZXlzKGEpLFxuICAgICAgICBrYiA9IG9iamVjdEtleXMoYik7XG4gIH0gY2F0Y2ggKGUpIHsvL2hhcHBlbnMgd2hlbiBvbmUgaXMgYSBzdHJpbmcgbGl0ZXJhbCBhbmQgdGhlIG90aGVyIGlzbid0XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIC8vIGhhdmluZyB0aGUgc2FtZSBudW1iZXIgb2Ygb3duZWQgcHJvcGVydGllcyAoa2V5cyBpbmNvcnBvcmF0ZXNcbiAgLy8gaGFzT3duUHJvcGVydHkpXG4gIGlmIChrYS5sZW5ndGggIT0ga2IubGVuZ3RoKVxuICAgIHJldHVybiBmYWxzZTtcbiAgLy90aGUgc2FtZSBzZXQgb2Yga2V5cyAoYWx0aG91Z2ggbm90IG5lY2Vzc2FyaWx5IHRoZSBzYW1lIG9yZGVyKSxcbiAga2Euc29ydCgpO1xuICBrYi5zb3J0KCk7XG4gIC8vfn5+Y2hlYXAga2V5IHRlc3RcbiAgZm9yIChpID0ga2EubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBpZiAoa2FbaV0gIT0ga2JbaV0pXG4gICAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgLy9lcXVpdmFsZW50IHZhbHVlcyBmb3IgZXZlcnkgY29ycmVzcG9uZGluZyBrZXksIGFuZFxuICAvL35+fnBvc3NpYmx5IGV4cGVuc2l2ZSBkZWVwIHRlc3RcbiAgZm9yIChpID0ga2EubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBrZXkgPSBrYVtpXTtcbiAgICBpZiAoIWRlZXBFcXVhbChhW2tleV0sIGJba2V5XSwgb3B0cykpIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHlwZW9mIGEgPT09IHR5cGVvZiBiO1xufVxuIiwidmFyIHN1cHBvcnRzQXJndW1lbnRzQ2xhc3MgPSAoZnVuY3Rpb24oKXtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChhcmd1bWVudHMpXG59KSgpID09ICdbb2JqZWN0IEFyZ3VtZW50c10nO1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBzdXBwb3J0c0FyZ3VtZW50c0NsYXNzID8gc3VwcG9ydGVkIDogdW5zdXBwb3J0ZWQ7XG5cbmV4cG9ydHMuc3VwcG9ydGVkID0gc3VwcG9ydGVkO1xuZnVuY3Rpb24gc3VwcG9ydGVkKG9iamVjdCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iamVjdCkgPT0gJ1tvYmplY3QgQXJndW1lbnRzXSc7XG59O1xuXG5leHBvcnRzLnVuc3VwcG9ydGVkID0gdW5zdXBwb3J0ZWQ7XG5mdW5jdGlvbiB1bnN1cHBvcnRlZChvYmplY3Qpe1xuICByZXR1cm4gb2JqZWN0ICYmXG4gICAgdHlwZW9mIG9iamVjdCA9PSAnb2JqZWN0JyAmJlxuICAgIHR5cGVvZiBvYmplY3QubGVuZ3RoID09ICdudW1iZXInICYmXG4gICAgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwgJ2NhbGxlZScpICYmXG4gICAgIU9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChvYmplY3QsICdjYWxsZWUnKSB8fFxuICAgIGZhbHNlO1xufTtcbiIsImV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHR5cGVvZiBPYmplY3Qua2V5cyA9PT0gJ2Z1bmN0aW9uJ1xuICA/IE9iamVjdC5rZXlzIDogc2hpbTtcblxuZXhwb3J0cy5zaGltID0gc2hpbTtcbmZ1bmN0aW9uIHNoaW0gKG9iaikge1xuICB2YXIga2V5cyA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gb2JqKSBrZXlzLnB1c2goa2V5KTtcbiAgcmV0dXJuIGtleXM7XG59XG4iLCJ2YXIgRW50aSA9IHJlcXVpcmUoJ2VudGknKSxcbiAgICBXaGF0Q2hhbmdlZCA9IHJlcXVpcmUoJ3doYXQtY2hhbmdlZCcpLFxuICAgIHNhbWUgPSByZXF1aXJlKCdzYW1lLXZhbHVlJyksXG4gICAgZmlybWVyID0gcmVxdWlyZSgnLi9maXJtZXInKSxcbiAgICBjcmVhdGVCaW5kaW5nID0gcmVxdWlyZSgnLi9iaW5kaW5nJyksXG4gICAgZnVuY3Rpb25FbWl0dGVyID0gcmVxdWlyZSgnLi9mdW5jdGlvbkVtaXR0ZXInKSxcbiAgICBzZXRQcm90b3R5cGVPZiA9IHJlcXVpcmUoJ3NldHByb3RvdHlwZW9mJyksXG4gICAgaXMgPSByZXF1aXJlKCcuL2lzJyk7XG5cbnZhciBwcm9wZXJ0eVByb3RvID0gT2JqZWN0LmNyZWF0ZShmdW5jdGlvbkVtaXR0ZXIpO1xuXG5wcm9wZXJ0eVByb3RvLl9mYXN0bl9wcm9wZXJ0eSA9IHRydWU7XG5wcm9wZXJ0eVByb3RvLl9maXJtID0gMTtcblxuZnVuY3Rpb24gcHJvcGVydHlUZW1wbGF0ZSh2YWx1ZSl7XG4gICAgaWYoIWFyZ3VtZW50cy5sZW5ndGgpe1xuICAgICAgICByZXR1cm4gdGhpcy5iaW5kaW5nICYmIHRoaXMuYmluZGluZygpIHx8IHRoaXMucHJvcGVydHkuX3ZhbHVlO1xuICAgIH1cblxuICAgIGlmKCF0aGlzLmRlc3Ryb3llZCl7XG4gICAgICAgIGlmKHRoaXMuYmluZGluZyl7XG4gICAgICAgICAgICB0aGlzLmJpbmRpbmcodmFsdWUpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucHJvcGVydHk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnZhbHVlVXBkYXRlKHZhbHVlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5wcm9wZXJ0eTtcbn1cblxuZnVuY3Rpb24gY2hhbmdlQ2hlY2tlcihjdXJyZW50LCBjaGFuZ2VzKXtcbiAgICBpZihjaGFuZ2VzKXtcbiAgICAgICAgdmFyIGNoYW5nZXMgPSBuZXcgV2hhdENoYW5nZWQoY3VycmVudCwgY2hhbmdlcyk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAgICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhjaGFuZ2VzLnVwZGF0ZSh2YWx1ZSkpLmxlbmd0aCA+IDA7XG4gICAgICAgIH07XG4gICAgfWVsc2V7XG4gICAgICAgIHZhciBsYXN0VmFsdWUgPSBjdXJyZW50O1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24obmV3VmFsdWUpe1xuICAgICAgICAgICAgaWYoIXNhbWUobGFzdFZhbHVlLCBuZXdWYWx1ZSkpe1xuICAgICAgICAgICAgICAgIGxhc3RWYWx1ZSA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cbn1cblxuXG5mdW5jdGlvbiBwcm9wZXJ0eUJpbmRpbmcobmV3QmluZGluZyl7XG4gICAgaWYoIWFyZ3VtZW50cy5sZW5ndGgpe1xuICAgICAgICByZXR1cm4gdGhpcy5iaW5kaW5nO1xuICAgIH1cblxuICAgIGlmKCFpcy5iaW5kaW5nKG5ld0JpbmRpbmcpKXtcbiAgICAgICAgbmV3QmluZGluZyA9IGNyZWF0ZUJpbmRpbmcobmV3QmluZGluZyk7XG4gICAgfVxuXG4gICAgaWYobmV3QmluZGluZyA9PT0gdGhpcy5iaW5kaW5nKXtcbiAgICAgICAgcmV0dXJuIHRoaXMucHJvcGVydHk7XG4gICAgfVxuXG4gICAgaWYodGhpcy5iaW5kaW5nKXtcbiAgICAgICAgdGhpcy5iaW5kaW5nLnJlbW92ZUxpc3RlbmVyKCdjaGFuZ2UnLCB0aGlzLnZhbHVlVXBkYXRlKTtcbiAgICB9XG5cbiAgICB0aGlzLmJpbmRpbmcgPSBuZXdCaW5kaW5nO1xuXG4gICAgaWYodGhpcy5tb2RlbCl7XG4gICAgICAgIHRoaXMucHJvcGVydHkuYXR0YWNoKHRoaXMubW9kZWwsIHRoaXMucHJvcGVydHkuX2Zpcm0pO1xuICAgIH1cblxuICAgIHRoaXMuYmluZGluZy5vbignY2hhbmdlJywgdGhpcy52YWx1ZVVwZGF0ZSk7XG4gICAgdGhpcy52YWx1ZVVwZGF0ZSh0aGlzLmJpbmRpbmcoKSk7XG5cbiAgICByZXR1cm4gdGhpcy5wcm9wZXJ0eTtcbn07XG5cbmZ1bmN0aW9uIGF0dGFjaFByb3BlcnR5KG9iamVjdCwgZmlybSl7XG4gICAgaWYoZmlybWVyKHRoaXMucHJvcGVydHksIGZpcm0pKXtcbiAgICAgICAgcmV0dXJuIHRoaXMucHJvcGVydHk7XG4gICAgfVxuXG4gICAgdGhpcy5wcm9wZXJ0eS5fZmlybSA9IGZpcm07XG5cbiAgICBpZighKG9iamVjdCBpbnN0YW5jZW9mIE9iamVjdCkpe1xuICAgICAgICBvYmplY3QgPSB7fTtcbiAgICB9XG5cbiAgICBpZih0aGlzLmJpbmRpbmcpe1xuICAgICAgICB0aGlzLm1vZGVsID0gb2JqZWN0O1xuICAgICAgICB0aGlzLmJpbmRpbmcuYXR0YWNoKG9iamVjdCwgMSk7XG4gICAgfVxuXG4gICAgaWYodGhpcy5wcm9wZXJ0eS5fZXZlbnRzICYmICdhdHRhY2gnIGluIHRoaXMucHJvcGVydHkuX2V2ZW50cyl7XG4gICAgICAgIHRoaXMucHJvcGVydHkuZW1pdCgnYXR0YWNoJywgb2JqZWN0LCAxKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5wcm9wZXJ0eTtcbn07XG5cbmZ1bmN0aW9uIGRldGFjaFByb3BlcnR5KGZpcm0pe1xuICAgIGlmKGZpcm1lcih0aGlzLnByb3BlcnR5LCBmaXJtKSl7XG4gICAgICAgIHJldHVybiB0aGlzLnByb3BlcnR5O1xuICAgIH1cblxuICAgIGlmKHRoaXMuYmluZGluZyl7XG4gICAgICAgIHRoaXMuYmluZGluZy5yZW1vdmVMaXN0ZW5lcignY2hhbmdlJywgdGhpcy52YWx1ZVVwZGF0ZSk7XG4gICAgICAgIHRoaXMuYmluZGluZy5kZXRhY2goMSk7XG4gICAgICAgIHRoaXMubW9kZWwgPSBudWxsO1xuICAgIH1cblxuICAgIGlmKHRoaXMucHJvcGVydHkuX2V2ZW50cyAmJiAnZGV0YWNoJyBpbiB0aGlzLnByb3BlcnR5Ll9ldmVudHMpe1xuICAgICAgICB0aGlzLnByb3BlcnR5LmVtaXQoJ2RldGFjaCcsIDEpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnByb3BlcnR5O1xufTtcblxuZnVuY3Rpb24gdXBkYXRlUHJvcGVydHkoKXtcbiAgICBpZighdGhpcy5kZXN0cm95ZWQpe1xuXG4gICAgICAgIGlmKHRoaXMucHJvcGVydHkuX3VwZGF0ZSl7XG4gICAgICAgICAgICB0aGlzLnByb3BlcnR5Ll91cGRhdGUodGhpcy5wcm9wZXJ0eS5fdmFsdWUsIHRoaXMucHJvcGVydHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wcm9wZXJ0eS5lbWl0KCd1cGRhdGUnLCB0aGlzLnByb3BlcnR5Ll92YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnByb3BlcnR5O1xufTtcblxuZnVuY3Rpb24gcHJvcGVydHlVcGRhdGVyKGZuKXtcbiAgICBpZighYXJndW1lbnRzLmxlbmd0aCl7XG4gICAgICAgIHJldHVybiB0aGlzLnByb3BlcnR5Ll91cGRhdGU7XG4gICAgfVxuICAgIHRoaXMucHJvcGVydHkuX3VwZGF0ZSA9IGZuO1xuICAgIHJldHVybiB0aGlzLnByb3BlcnR5O1xufTtcblxuZnVuY3Rpb24gZGVzdHJveVByb3BlcnR5KCl7XG4gICAgaWYoIXRoaXMuZGVzdHJveWVkKXtcbiAgICAgICAgdGhpcy5kZXN0cm95ZWQgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMucHJvcGVydHlcbiAgICAgICAgICAgIC5yZW1vdmVBbGxMaXN0ZW5lcnMoJ2NoYW5nZScpXG4gICAgICAgICAgICAucmVtb3ZlQWxsTGlzdGVuZXJzKCd1cGRhdGUnKVxuICAgICAgICAgICAgLnJlbW92ZUFsbExpc3RlbmVycygnYXR0YWNoJyk7XG5cbiAgICAgICAgdGhpcy5wcm9wZXJ0eS5lbWl0KCdkZXN0cm95Jyk7XG4gICAgICAgIHRoaXMucHJvcGVydHkuZGV0YWNoKCk7XG4gICAgICAgIGlmKHRoaXMuYmluZGluZyl7XG4gICAgICAgICAgICB0aGlzLmJpbmRpbmcuZGVzdHJveSh0cnVlKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5wcm9wZXJ0eTtcbn07XG5cbmZ1bmN0aW9uIHByb3BlcnR5RGVzdHJveWVkKCl7XG4gICAgcmV0dXJuIHRoaXMuZGVzdHJveWVkO1xufTtcblxuZnVuY3Rpb24gYWRkUHJvcGVydHlUbyhjb21wb25lbnQsIGtleSl7XG4gICAgY29tcG9uZW50LnNldFByb3BlcnR5KGtleSwgdGhpcy5wcm9wZXJ0eSk7XG5cbiAgICByZXR1cm4gdGhpcy5wcm9wZXJ0eTtcbn07XG5cbmZ1bmN0aW9uIGNyZWF0ZVByb3BlcnR5KGN1cnJlbnRWYWx1ZSwgY2hhbmdlcywgdXBkYXRlcil7XG4gICAgaWYodHlwZW9mIGNoYW5nZXMgPT09ICdmdW5jdGlvbicpe1xuICAgICAgICB1cGRhdGVyID0gY2hhbmdlcztcbiAgICAgICAgY2hhbmdlcyA9IG51bGw7XG4gICAgfVxuXG4gICAgdmFyIHByb3BlcnR5U2NvcGUgPVxuICAgICAgICBwcm9wZXJ0eSA9IHByb3BlcnR5VGVtcGxhdGUuYmluZChwcm9wZXJ0eVNjb3BlKVxuICAgICAgICBwcm9wZXJ0eVNjb3BlID0ge1xuICAgICAgICBoYXNDaGFuZ2VkOiBjaGFuZ2VDaGVja2VyKGN1cnJlbnRWYWx1ZSwgY2hhbmdlcyksXG4gICAgICAgIHZhbHVlVXBkYXRlOiBmdW5jdGlvbih2YWx1ZSl7XG4gICAgICAgICAgICBwcm9wZXJ0eS5fdmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIGlmKCFwcm9wZXJ0eVNjb3BlLmhhc0NoYW5nZWQodmFsdWUpKXtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwcm9wZXJ0eS5lbWl0KCdjaGFuZ2UnLCBwcm9wZXJ0eS5fdmFsdWUpO1xuICAgICAgICAgICAgcHJvcGVydHkudXBkYXRlKCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgdmFyIHByb3BlcnR5ID0gcHJvcGVydHlTY29wZS5wcm9wZXJ0eSA9IHByb3BlcnR5VGVtcGxhdGUuYmluZChwcm9wZXJ0eVNjb3BlKTtcblxuICAgIHByb3BlcnR5Ll92YWx1ZSA9IGN1cnJlbnRWYWx1ZTtcbiAgICBwcm9wZXJ0eS5fdXBkYXRlID0gdXBkYXRlcjtcblxuICAgIHNldFByb3RvdHlwZU9mKHByb3BlcnR5LCBwcm9wZXJ0eVByb3RvKTtcblxuICAgIHByb3BlcnR5LmJpbmRpbmcgPSBwcm9wZXJ0eUJpbmRpbmcuYmluZChwcm9wZXJ0eVNjb3BlKTtcbiAgICBwcm9wZXJ0eS5hdHRhY2ggPSBhdHRhY2hQcm9wZXJ0eS5iaW5kKHByb3BlcnR5U2NvcGUpO1xuICAgIHByb3BlcnR5LmRldGFjaCA9IGRldGFjaFByb3BlcnR5LmJpbmQocHJvcGVydHlTY29wZSk7XG4gICAgcHJvcGVydHkudXBkYXRlID0gdXBkYXRlUHJvcGVydHkuYmluZChwcm9wZXJ0eVNjb3BlKTtcbiAgICBwcm9wZXJ0eS51cGRhdGVyID0gcHJvcGVydHlVcGRhdGVyLmJpbmQocHJvcGVydHlTY29wZSk7XG4gICAgcHJvcGVydHkuZGVzdHJveSA9IGRlc3Ryb3lQcm9wZXJ0eS5iaW5kKHByb3BlcnR5U2NvcGUpO1xuICAgIHByb3BlcnR5LmRlc3Ryb3llZCA9IHByb3BlcnR5RGVzdHJveWVkLmJpbmQocHJvcGVydHlTY29wZSk7XG4gICAgcHJvcGVydHkuYWRkVG8gPSBhZGRQcm9wZXJ0eVRvLmJpbmQocHJvcGVydHlTY29wZSk7XG5cbiAgICByZXR1cm4gcHJvcGVydHk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVByb3BlcnR5OyIsInZhciB0b2RvID0gW10sXG4gICAgdG9kb0tleXMgPSBbXSxcbiAgICBzY2hlZHVsZWQsXG4gICAgdXBkYXRlcyA9IDA7XG5cbmZ1bmN0aW9uIHJ1bigpe1xuICAgIHZhciBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuXG4gICAgd2hpbGUodG9kby5sZW5ndGggJiYgRGF0ZS5ub3coKSAtIHN0YXJ0VGltZSA8IDE2KXtcbiAgICAgICAgdG9kb0tleXMuc2hpZnQoKTtcbiAgICAgICAgdG9kby5zaGlmdCgpKCk7XG4gICAgfVxuXG4gICAgaWYodG9kby5sZW5ndGgpe1xuICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUocnVuKTtcbiAgICB9ZWxzZXtcbiAgICAgICAgc2NoZWR1bGVkID0gZmFsc2U7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzY2hlZHVsZShrZXksIGZuKXtcbiAgICBpZih+dG9kb0tleXMuaW5kZXhPZihrZXkpKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRvZG8ucHVzaChmbik7XG4gICAgdG9kb0tleXMucHVzaChrZXkpO1xuXG4gICAgaWYoIXNjaGVkdWxlZCl7XG4gICAgICAgIHNjaGVkdWxlZCA9IHRydWU7XG4gICAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZShydW4pO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzY2hlZHVsZTsiLCJmdW5jdGlvbiB1cGRhdGVUZXh0KCl7XG4gICAgaWYoIXRoaXMuZWxlbWVudCl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgdmFsdWUgPSB0aGlzLnRleHQoKTtcblxuICAgIHRoaXMuZWxlbWVudC50ZXh0Q29udGVudCA9ICh2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGF1dG9SZW5kZXIoY29udGVudCl7XG4gICAgdGhpcy5lbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY29udGVudCk7XG59XG5cbmZ1bmN0aW9uIGF1dG9UZXh0KHRleHQsIGZhc3RuLCBjb250ZW50KSB7XG4gICAgdGV4dC5yZW5kZXIgPSBhdXRvUmVuZGVyLmJpbmQodGV4dCwgY29udGVudCk7XG5cbiAgICByZXR1cm4gdGV4dDtcbn1cblxuZnVuY3Rpb24gcmVuZGVyKCl7XG4gICAgdGhpcy5lbGVtZW50ID0gdGhpcy5jcmVhdGVUZXh0Tm9kZSh0aGlzLnRleHQoKSk7XG4gICAgdGhpcy5lbWl0KCdyZW5kZXInKTtcbn07XG5cbmZ1bmN0aW9uIHRleHRDb21wb25lbnQoZmFzdG4sIGNvbXBvbmVudCwgdHlwZSwgc2V0dGluZ3MsIGNoaWxkcmVuKXtcbiAgICBpZihzZXR0aW5ncy5hdXRvKXtcbiAgICAgICAgZGVsZXRlIHNldHRpbmdzLmF1dG87XG4gICAgICAgIGlmKCFmYXN0bi5pc0JpbmRpbmcoY2hpbGRyZW5bMF0pKXtcbiAgICAgICAgICAgIHJldHVybiBhdXRvVGV4dChjb21wb25lbnQsIGZhc3RuLCBjaGlsZHJlblswXSk7XG4gICAgICAgIH1cbiAgICAgICAgc2V0dGluZ3MudGV4dCA9IGNoaWxkcmVuLnBvcCgpO1xuICAgIH1cblxuICAgIGNvbXBvbmVudC5jcmVhdGVUZXh0Tm9kZSA9IHRleHRDb21wb25lbnQuY3JlYXRlVGV4dE5vZGU7XG4gICAgY29tcG9uZW50LnJlbmRlciA9IHJlbmRlci5iaW5kKGNvbXBvbmVudCk7XG5cbiAgICBjb21wb25lbnQuc2V0UHJvcGVydHkoJ3RleHQnLCBmYXN0bi5wcm9wZXJ0eSgnJywgdXBkYXRlVGV4dC5iaW5kKGNvbXBvbmVudCkpKTtcblxuICAgIHJldHVybiBjb21wb25lbnQ7XG59XG5cbnRleHRDb21wb25lbnQuY3JlYXRlVGV4dE5vZGUgPSBmdW5jdGlvbih0ZXh0KXtcbiAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodGV4dCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHRleHRDb21wb25lbnQ7IiwiXG4vKipcbiAqIENoZWNrIGlmIHRoZSBnaXZlbiBgeWVhcmAgaXMgYSBsZWFwIHllYXJcbiAqXG4gKiBAYXBpIHB1YmxpY1xuICogQHBhcmFtIHtEYXRlfE51bWJlcn0geWVhclxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICh5ZWFyKSB7XG4gIHllYXIgPSAoeWVhciBpbnN0YW5jZW9mIERhdGUpXG4gICAgICA/IHllYXIuZ2V0RnVsbFllYXIoKVxuICAgICAgOiB5ZWFyO1xuXG4gIHJldHVybiAhKG5ldyBEYXRlKHllYXIsIDEsIDI5KS5nZXRNb250aCgpIC0gMSk7XG59O1xuIiwidmFyIHBhcnNlRGF0ZSA9IHJlcXVpcmUoJ2RhdGUtcGFyc2UnKSxcbiAgICBkZWh1bWFuaXplRGF0ZSA9IHJlcXVpcmUoJ2RlaHVtYW5pemUtZGF0ZScpLFxuICAgIGF1enppZURhdGUgPSAvKC4qKVtcXC8sXFxzLV0oLiopW1xcLyxcXHMtXSguezR9KS87XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odmFsdWUpe1xuICAgIHZhciBkYXRlO1xuXG4gICAgaWYodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyl7XG4gICAgICAgIHZhciBtYXRjaCA9IHZhbHVlLm1hdGNoKGF1enppZURhdGUpO1xuICAgICAgICBpZihtYXRjaCl7XG4gICAgICAgICAgICBkYXRlID0gbmV3IERhdGUoW21hdGNoWzNdLCBtYXRjaFsyXSwgbWF0Y2hbMV1dLmpvaW4oJy8nKSk7XG4gICAgICAgICAgICBpZighaXNOYU4oZGF0ZSkpe1xuICAgICAgICAgICAgICAgIHJldHVybiBkYXRlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHBhcnNlRGF0ZShkZWh1bWFuaXplRGF0ZSh2YWx1ZSkgfHwgdmFsdWUpO1xufTsiXX0=
