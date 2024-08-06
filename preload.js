const { shell } = require('electron'); // This should be at the top of your file

function openPS5PageIfNotOpened() {
    if (!calibrationPageOpened && localStorage.getItem('calResult') !== 'Pass') {
        shell.openExternal('http://localhost/cal.html'); // Use the full URL you need to open
        calibrationPageOpened = true;
    }
}
