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
    .datepicker-component ::-webkit-clear-button,
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
    // parseDate(settings.value);
    // console.log('value',settings.value());
    component.extend('_generic', settings, children);
    component.setProperty('date');

    component.getEventElement = function(){
        return component.textInput;
    };

    component.getPropertyElement = function(key){
        if(key === 'class'){
            return component.element;
        }

        if(key === 'value'){
            return; // Don't auto-bind the value property.
        }

        return component.textInput && component.textInput.element;
    };

    component.render = function(){
        component.textInput = fastn('input', {
            value: '',
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

        function update(date){
            date = date && new Date(date);
            var noDate = !date || isNaN(date);

            component.textInput.value(noDate ? '' : date.toDateString());
            component.datePicker.value(noDate ? undefined : date);
        }

        component.date.on('update', update);

        component.on('render',function(){
          let date = settings.value() &&  new Date(settings.value());
          var noDate = !date || isNaN(date);

          component.textInput.value(noDate ? '' : date.toDateString());
          component.datePicker.value(noDate ? undefined : date);
        })

        component.emit('render');

        return component;
    };

    return component;
};
