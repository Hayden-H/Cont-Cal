const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let calibrationPageOpened = false;

function openPS5PageIfNotOpened() {
    if (!calibrationPageOpened && localStorage.getItem('calResult') !== 'Pass') {
        ipcRenderer.send('open-external-calibration');
        calibrationPageOpened = true;
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            devTools: true
        }
    });

    mainWindow.loadFile('ConCal.html');

    // Open Developer Tools by default
    mainWindow.webContents.openDevTools();

    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open Calibration',
                    click() {
                        openPS5PageIfNotOpened('Fail');
                    }
                },
                {
                    label: 'Exit',
                    click() {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Toggle Developer Tools',
                    accelerator: 'CmdOrCtrl+Shift+I',
                    click() {
                        console.log('Toggle Developer Tools clicked');
                        if (mainWindow && mainWindow.webContents) {
                            if (mainWindow.webContents.isDevToolsOpened()) {
                                console.log('Closing DevTools');
                                mainWindow.webContents.closeDevTools();
                            } else {
                                console.log('Opening DevTools');
                                mainWindow.webContents.openDevTools();
                            }
                        } else {
                            console.log('mainWindow or webContents is undefined');
                        }
                    }
                },
                {
                    label: 'Reload',
                    accelerator: 'CmdOrCtrl+R',
                    click() {
                        mainWindow.reload();
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    // Poll for calibration result
    setInterval(checkCalibrationResult, 1000);
}

function checkCalibrationResult() {
    mainWindow.webContents.executeJavaScript('localStorage.getItem("CalResult")').then(result => {
        if (result === 'Pass') {
            console.log('Calibration passed!');
            // Handle the result here
        }
    }).catch(error => {
        console.error('Failed to check calibration result:', error);
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Handle IPC message to open external file
ipcMain.on('open-external-calibration', (event) => {
    const filePath = path.join(__dirname, 'cal.html');
    shell.openExternal(`file://${filePath}`);
});
