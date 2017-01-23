# datepicker-component

A simple datepicker component

Built with `fastn.js`

Accepts a wide range of inputs like 'Tomorrow', 'Last friday', '20-5-2016'

# Usage

## Settings

```
{
    date: A date object
}
```

## Standalone

```
// Create the datepicker
var datepicker = createPicker({
        date: new Date()
    });

// Watch for changes to the datepicker's date
datepicker.date.on('change', function(date){
    console.log(date);
});

// Put the datepicker's element somewhere in the DOM.
document.body.appendChild(datepicker.element);
```

## Fastn component

```
var fastn = require('fastn')({
    ... other components...
    datePicker: require('datepicker-component/datepickerComponent')
});

var datePicker = fastn('datePicker', { options... });
```

datePicker will attempt to use `text`, and `_generic` components provided by fastn.

## Inserting

```
someDomNode.appendChild(datePicker.element);
```

## Properties

### Date

```
// retrieve date
datePicker.date(); // returns current date

// set date
datePicker.date(newValue); // returns datePicker.date property

// watch for changes
datePicker.date.on('change', function(date){
    // Do something
});
```