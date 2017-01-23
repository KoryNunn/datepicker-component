var createDatePicker = require('../'),
    crel = require('crel');

window.onload = function(){

    // Create a datePicker.
    var datePicker = createDatePicker({
        placeholder: 'Enter a date',
        date: new Date()
    });

    document.body.appendChild(datePicker.element);
};