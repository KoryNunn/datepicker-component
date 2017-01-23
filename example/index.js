var createDatePicker = require('../'),
    crel = require('crel');

window.onload = function(){

    // Create a datePicker.
    var datePicker = createDatePicker({
        placeholder: 'Enter a date'
    });

    document.body.appendChild(datePicker.element);
};