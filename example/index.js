var createDatePicker = require('../'),
    crel = require('crel');

var fastn = require('fastn')({
    _generic: require('fastn/genericComponent'),
    text: require('fastn/textComponent'),
    datePicker: require('../datepickerComponent')
});

window.onload = function(){

    // Create a datePicker.
    var datePicker = createDatePicker({
        placeholder: 'Enter a date',
        date: new Date()
    });

    var model = new fastn.Model({
        date: new Date('2017-3-3')
    });

    var fastnDatePicker = fastn('datePicker', {
        placeholder: 'Enter a date',
        date: fastn.binding('date')
    })
    .attach(model)
    .render();

    var fastnLabel = fastn('label', fastn.binding('date', function(date){
        return date.toLocaleString();
    }))
    .attach(model)
    .render();

    crel(document.body,
        crel('h2', 'Standalone usage'),
        datePicker.element,
        crel('h2', 'Fastn usage'),
        fastnDatePicker.element,
        crel('h2', 'Fastn bound label (.toLocaleString)'),
        fastnLabel.element
    );
};