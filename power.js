let calibrationPageOpened = false;
let totalButtons;
let pressedButtons = new Set();
let modalShown = false;
let currentControllerType;
let currentQuestionIndex = 0;
let questions = [];

localStorage.setItem('CalResult', 'Pass');


const buttonToIdMap = {
    0: "Bdown",
    1: "Bright",
    2: "Bleft",
    3: "Btop",
    4: "L1",
    5: "R1",
    6: "L2",
    7: "R2",
    8: "Lmeta",
    9: "Rmeta",
    10: "LeftStick",
    11: "RightStick",
    12: "Dup",
    13: "Ddown",
    14: "Dleft",
    15: "Dright",
    16: "homeButton",
    17: "Tpad"
};



const controllerTests = {
    xbox: {
        questions: [
            {
                question: "Do trigger increase/decrease when pressed/released? (0%, 50%, 100%)",
                yesFunction: testTriggerYes,
                noFunction: testTriggerNo,
                action: null,
                testKey: "Triggers"
            },
            {
                question: "Is the housing in acceptable condition?",
                yesFunction: testHousingYes,
                noFunction: testHousingNo,
                action: null,
                testKey: "Housing"
            },
            {
                question: "Does vibration work?",
                yesFunction: testVibrationYes,
                noFunction: testVibrationNo,
                action: "activateVibration",
                testKey: "Vibration"
            },
            {
                question: "Are the joysticks responding and returning to the 0 location?",
                yesFunction: testJoysticksYes,
                noFunction: testJoysticksNo,
                action: "updateJoysticks",
                testKey: "Joysticks"
            },
            {
                question: "Are all buttons pressing/releasing smoothly?",
                yesFunction: buttonsYes,
                noFunction: buttonsNo,
                action: null,
                testKey: "Buttons"
            },
            {
                question: "Are the LED(s) working?",
                yesFunction: testLEDYes,
                noFunction: testLEDNo,
                action: null,
                testKey: "LEDs"
            }
        ]
    },
    playstation: {
        questions: [
            {
                question: "Do trigger increase/decrease when pressed/released? (0%, 50%, 100%)",
                yesFunction: testTriggerYes,
                noFunction: testTriggerNo,
                testKey: "Triggers"
            },
            {
                question: "Is the housing in acceptable condition?",
                yesFunction: testHousingYes,
                noFunction: testHousingNo,
                action: null,
                testKey: "Housing"
            },
            {
                question: "Do the adaptive triggers function correctly?",
                yesFunction: testAdaptiveTriggersYes,
                noFunction: testAdaptiveTriggersNo,
                action: null,
                testKey: "Triggers"
            },
            {
                question: "Are the joysticks responding and returning to the 0 location?",
                yesFunction: testJoysticksYes,
                noFunction: testJoysticksNo,
                action: "updateJoysticks",
                testKey: "Joysticks"
            },
            {
                question: "Are all buttons pressing/releasing smoothly?",
                yesFunction: buttonsYes,
                noFunction: buttonsNo,
                action: null,
                testKey: "Buttons"
            },
            {
                question: "Are the LED(s) working?",
                yesFunction: testLEDYes,
                noFunction: testLEDNo,
                action: null,
                testKey: "LEDs"
            },
            {
                question: "Does the mic detect audio?",
                yesFunction: micCheckYes,
                noFunction: micCheckNo,
                action: "setupAndDrawEqualizer",
                testKey: "MicCheck"
            },
            {
                question: "Is the touchpad responding?",
                yesFunction: touchpadYes,
                noFunction: touchpadNo,
                action: null,
                testKey: "Touchpad"
            },
            {
                question: "Does vibration work?",
                yesFunction: testVibrationYes,
                noFunction: testVibrationNo,
                action: "activateVibration",
                testKey: "Vibration"
            }
        ]
    }
};

// Usage
function getTestDetails(controllerType) {
    return controllerTests[controllerType] || { questions: [], result: [] };
}


document.addEventListener('DOMContentLoaded', function () {
    localStorage.clear();
    const workOrderInput = document.getElementById('workOrder');
    if (workOrderInput) {
        workOrderInput.focus();
        workOrderInput.addEventListener('keypress', function (event) {
            if (event.key === 'Enter') {
                // Directly get the value inside the event listener
                const workOrderValue = workOrderInput.value.trim();
                checkAndSaveWorkOrder(workOrderValue);
                localStorage.setItem('CalResult', 'Fail');
            }
        });
    }
});

function checkAndSaveWorkOrder(workOrderValue) {
    console.log("Received work order value:", workOrderValue);  // Log the input value for debugging
    if (workOrderValue.length === 10 && workOrderValue.startsWith('w0')) {
        localStorage.setItem('workOrder', workOrderValue);
        document.querySelectorAll('.conMessage').forEach(el => el.style.display = 'block');
        startGamepadListeners();

        // Hide the work order input box
        const workOrderInput = document.getElementById('workOrder');
        if (workOrderInput) {
            workOrderInput.style.display = 'none';
        }

        console.log("Work order accepted.");  // Notify that the work order is valid
    } else {
        alert("Invalid work order.");
    }
}


function startGamepadListeners() {
    window.addEventListener('gamepadconnected', function (event) {
        const gamepad = event.gamepad;
        document.querySelectorAll('.conMessage').forEach(el => el.style.display = 'none');
        console.log('A gamepad connected:', gamepad.id);

        
        if (gamepad.id.toLowerCase().includes('xbox')) {
            controllerType = 'xbox';

            localStorage.setItem("CalResult", "Pass");
        } else if (gamepad.id.toLowerCase().includes('054c') || gamepad.id.toLowerCase().includes('dualsense')) {
            controllerType = 'playstation';

        } else controllerType = 'playstation';


        
        console.log("Detected controller type:", controllerType);

        if (controllerType) {
            questions = controllerTests[controllerType].questions; // Ensure this is set before calling any function that uses `questions`
            currentQuestionIndex = 0; // Reset the index
            console.log("Questions loaded for", controllerType, questions);
        }

        if (gamepad) {
            totalButtons = gamepad.buttons.length;
            saveGamepadDetails(gamepad);
            pollGamepads();
        }
    });
}
function saveGamepadDetails(gamepad) {
    if (!gamepad) {
        console.error("saveGamepadDetails called with an undefined gamepad.");
        return;
    }

    // Check if the gamepad is already stored
    if (localStorage.getItem(`gamepad_${gamepad.index}`)) {
        console.log(`Gamepad at index ${gamepad.index} is already saved.`);
        return;
    }

    const gamepadDetails = {
        id: gamepad.id,
        buttons: gamepad.buttons.length
    };
    totalButtons = gamepad.buttons.length;

    localStorage.setItem(`gamepad_${gamepad.index}`, JSON.stringify(gamepadDetails));
    console.log('Gamepad details saved:', gamepadDetails);
    // Set the visibility of the appropriate SVG
    if (gamepad.id.toLowerCase().includes('xbox')) {
        localStorage.setItem('Triggers', '');
        localStorage.setItem("CalResult", "Pass");
        document.getElementById('xboxsvg').style.display = 'block';
        document.getElementById('ps5svg').style.display = 'none';
        localStorage.setItem('controllerType', "xbox");
    }
    else if (gamepad.id.toLowerCase().includes('dualsense')) {
        document.getElementById('ps5svg').style.display = 'block';
        document.getElementById('xboxsvg').style.display = 'none';
        localStorage.setItem('controllerType', "playstation");
        openPS5PageIfNotOpened();
    }
    else {
        document.getElementById('ps5svg').style.display = 'block';
        localStorage.setItem('controllerType', "playstation");
        openPS5PageIfNotOpened();
    }
}


function openPS5PageIfNotOpened() {
    if (!calibrationPageOpened && localStorage.getItem('calResult') !== 'Pass') {
        window.open('cal.html');
        calibrationPageOpened = true;
    }
}

function updateButtonStates(gamepad) {
    for (let index = 0; index < gamepad.buttons.length; index++) {
        const button = gamepad.buttons[index];

        // Only proceed for L2 and R2 triggers (indices 6 and 7)
        if (index === 6 || index === 7) {
            const triggerValue = button.value; // Value ranges from 0 to 1
            const triggerName = index === 6 ? 'L2' : 'R2';

            // Update the fuel gauge height for the trigger element in the UI
            const triggerElement = document.getElementById(`${triggerName}trigger`);
            if (triggerElement) {
                triggerElement.style.height = `${triggerValue * 100}%`; // Adjust height based on trigger pressure
            }

            // Update the live readings display only if the value is valid
            if (!isNaN(triggerValue)) {
                updateTriggerReadings(triggerName, triggerValue);
            }
        }

        // Existing logic for other buttons
        const baseElementId = buttonToIdMap[index];
        if (baseElementId) {
            const suffix = gamepad.id.toLowerCase().includes('xbox') ? '1' : '';
            const svgElement = document.querySelector(`#ps5svg #${baseElementId}${suffix}, #xboxsvg #${baseElementId}${suffix}`);
            
            if (svgElement) {
                svgElement.style.opacity = '1'; // Ensure the element is visible

                // Regular press/release logic for non-trigger buttons
                const isPressed = button.pressed;
                if (isPressed) {
                    if (!pressedButtons.has(index)) {
                        pressedButtons.add(index);
                        svgElement.classList.remove("greenFill");
                        svgElement.classList.add("fill");
                    }
                } else {
                    if (pressedButtons.has(index)) {
                        pressedButtons.delete(index);
                        svgElement.classList.remove("fill");
                        svgElement.classList.add("greenFill");
                        console.log(`Button ${index} (${baseElementId}${suffix}) released. Added 'greenFill', removed 'fill'.`);
                    }
                }
            } else {
                console.error(`No SVG element found with id: ${baseElementId}${suffix}`);
            }
        }
    }
    checkButtonCount();  // Ensure this is called after updating states
}

// Function to display live trigger readings under the question text
function updateTriggerReadings(triggerName, triggerValue) {
    const questionText = document.getElementById("liveReading");

    // Find or create an element to display the live reading
    let triggerReading = document.getElementById(`liveReading${triggerName}`);
    if (!triggerReading) {
        const lineBreak = document.createElement("br"); // Create line break
        triggerReading = document.createElement("span"); // Create span element for the reading
        triggerReading.id = `liveReading${triggerName}`;
        
        // Append the line break and the reading span to the question text
        questionText.appendChild(lineBreak);
        questionText.appendChild(triggerReading);
    }

    // Update the text content with the current reading
    triggerReading.textContent = `${triggerName} trigger level: ${(triggerValue * 100).toFixed(1)}%`;
}


function checkButtonCount() {
    const greenFilledElements = document.querySelectorAll('.greenFill');
    if (greenFilledElements.length === totalButtons && !modalShown) {
        localStorage.setItem("buttonsCheck", "Pass");
        modalShown = true;  // Set this first to avoid potential re-entry issues
        showQuestion();  // Now start showing questions as all conditions are met
    }
}


function pollGamepads() {
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
        const gamepad = gamepads[i];
        if (gamepad) {
            updateButtonStates(gamepad);
        }
    }
    requestAnimationFrame(pollGamepads);
}


function showFinalResult() {
    
    const elements = document.getElementsByClassName("oqcButtons");

    // Hide all button elements
    Array.from(elements).forEach(element => element.style.display = "none");

    const closeButton = document.getElementById("closeModalBtn");
    closeButton.style.display = "block"; // Make the close button visible

    const resultMessage = document.getElementById("questionText");
    const oqcResult = localStorage.getItem("oqcResult");
    const resultClass = oqcResult === "Pass" ? "Pass" : "fail"; // Determine the class based on the result

    // Update the result display with appropriate coloring
    resultMessage.innerHTML = `OQC Complete. Result: <strong class="${resultClass}">${oqcResult}</strong><br/>`;

    let tests = ["Housing", "Vibration", "Triggers", "LEDs", "Joysticks", "buttonsCheck", "MicCheck", "CalResult"];
    tests.forEach(test => {
        let testResult = localStorage.getItem(test);
        if (testResult !== null) {  // Only display results for tests that are not null
            let testClass = testResult === "Pass" ? "pass" : "fail"; // Apply class based on the test result
            resultMessage.innerHTML += `<span class="test-result">${test}: <strong class="${testClass}">${testResult}</strong></span><br/>`;
        }
    });

    document.getElementById("calCompleteModal").style.display = 'flex'; // Show the modal
}




function checkOqcResult() {
    let controllerType = localStorage.getItem('controllerType'); // Assume 'controllerType' is saved correctly in localStorage
    let questions = controllerTests[controllerType].questions;

    let allTestsPass = true; // Start with all tests passing
    let failedTests = []; // Array to hold names of failed tests for detailed logging
    
    questions.forEach(question => {
        let testResult = localStorage.getItem(question.testKey);
        if (testResult !== "Pass") {
            allTestsPass = false; // Any test not passing will set this to false
            failedTests.push(question.question); // Add the question to failed tests for logging
        }
    });

    let calibrationPasses = localStorage.getItem("CalResult") === "Pass";
    let oqcResult = (allTestsPass && calibrationPasses) ? "Pass" : "Fail";
    localStorage.setItem("oqcResult", oqcResult);

    // Log the outcome and reasons for failure if any
    if (oqcResult === "Fail") {
        console.log("OQC Result: Fail");
        console.log("Failed Tests:", failedTests.join(", ")); // Logs the questions of the failed tests
        if (!calibrationPasses) {
            console.log("Calibration check failed.");
        }
    } else {
        console.log("OQC Result: Pass");
        localStorage.setItem("oqcResult", "Pass");
    }
}



// Example test functions

function testHousingYes() {
    localStorage.setItem("Housing", "Pass");
    checkOqcResult();
}

function testHousingNo() {
    localStorage.setItem("Housing", "Fail");
    checkOqcResult();
}

function touchpadYes() {
    localStorage.setItem("Touchpad", "Pass");
    checkOqcResult();
}

function touchpadNo() {
    localStorage.setItem("Touchpad", "Fail");
    checkOqcResult();
}

function testHousingYes() {
    localStorage.setItem("Housing", "Pass");
    checkOqcResult();
}

function testHousingNo() {
    localStorage.setItem("Housing", "Fail");
    checkOqcResult();
}

function testVibrationYes() {
    localStorage.setItem("Vibration", "Pass");
    vibeCheck = false; // Disable further vibration
    checkOqcResult();
}

function testVibrationNo() {
    localStorage.setItem("Vibration", "Fail");
    vibeCheck = false; // Disable further vibration
    checkOqcResult();
}

function testAdaptiveTriggersYes() {
    localStorage.setItem("Triggers", "Pass");
    checkOqcResult();
}

function testAdaptiveTriggersNo() {
    localStorage.setItem("Triggers", "Fail");
    checkOqcResult();
}

function testTriggerYes() {
    var triggerOutput = document.getElementById("liveReading");
    localStorage.setItem("Triggers", "Pass");
    triggerOutput.style.display = "none";
    checkOqcResult();
}

function testTriggerNo() {
    var triggerOutput = document.getElementById("liveReading");
    localStorage.setItem("Triggers", "Fail");
    triggerOutput.style.display = "none";
    checkOqcResult();
}

function testLEDYes() {
    localStorage.setItem("LEDs", "Pass");
    checkOqcResult();
}

function testLEDNo() {
    localStorage.setItem("LEDs", "Fail");
    checkOqcResult();
}

function buttonsYes() {
    localStorage.setItem("Buttons", "Pass");
}

function buttonsNo() {
    localStorage.setItem("Buttons", "Fail");
}

function testJoysticksYes() {
    localStorage.setItem("Joysticks", "Pass");
    document.getElementById("joystickContainer").style.display = "none";
    saveJoystickReadings();
    checkOqcResult();
}

function testJoysticksNo() {
    localStorage.setItem("Joysticks", "Fail");
    document.getElementById("joystickContainer").style.display = "none";
    saveJoystickReadings();
    checkOqcResult();
}

function micCheckYes() {
    localStorage.setItem("MicCheck", "Pass");
    document.getElementById('equalizerCanvas').style.display = 'none';
    console.log("Mic test passed.");
}

function micCheckNo() {
    localStorage.setItem("MicCheck", "Fail");
    document.getElementById('equalizerCanvas').style.display = 'none';
    console.log("Mic test failed.");
}

function displayJoystickCanvases() {
    const joystickContainer = document.getElementById("joystickContainer");
    if (joystickContainer) {
        joystickContainer.style.display = 'flex';
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // Attach event listener to "Yes" button
    const yesButton = document.getElementById("oqcYes");
    if (yesButton) {
        yesButton.addEventListener("click", function () {
            const question = questions[currentQuestionIndex];
            if (question.yesFunction) {
                question.yesFunction();
            }
            currentQuestionIndex++;
            if (currentQuestionIndex < questions.length) {
                showQuestion();
            } else {
                showFinalResult();
            }
        });
    }

    // Attach event listener to "No" button
    const noButton = document.getElementById("oqcNo");
    if (noButton) {
        noButton.addEventListener("click", function () {
            const question = questions[currentQuestionIndex];
            if (question.noFunction) {
                question.noFunction();
            }
            currentQuestionIndex++;
            if (currentQuestionIndex < questions.length) {
                showQuestion();
            } else {
                showFinalResult();
            }
        });
    }
});




console.log("Attempting to show question with index", currentQuestionIndex, "from", questions);


function showQuestion() {
    if (currentQuestionIndex < questions.length) {
        const question = questions[currentQuestionIndex];
        document.getElementById("questionText").innerText = question.question;
        document.getElementById("calCompleteModal").style.display = 'flex';
        document.getElementById("oqcYes").style.display = "inline-block";
        document.getElementById("oqcNo").style.display = "inline-block";
        document.getElementById("closeModalBtn").style.display = "none";

        // Display joystick container if needed
        const joystickContainer = document.getElementById("joystickContainer");
        if (question.action === "updateJoysticks") {
            joystickContainer.style.display = 'flex'; // Ensure this is visible
            updateJoysticks();
            //window[question.action](); // Update the joystick visualization
        } else {
            joystickContainer.style.display = 'none'; // Hide if not relevant
        }

        // Execute any additional action associated with the question
        if (question.action && question.action !== "updateJoysticks") {
            window[question.action](); // Dynamically call the action function
        }
    } else {
        showFinalResult();
    }
}





function getConnectedGamepad() {
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
            activeGamepadIndex = i;
            return gamepads[i];
        }
    }
    return null; // Return null if no gamepad is connected
}


document.addEventListener('DOMContentLoaded', function () {
    const leftJoystickCanvas = document.getElementById('leftJoystickCanvas');
    const rightJoystickCanvas = document.getElementById('rightJoystickCanvas');
    const leftJoystickPosition = document.getElementById('leftJoystickAxes');
    const rightJoystickPosition = document.getElementById('rightJoystickAxes');
    const leftCtx = leftJoystickCanvas.getContext('2d');
    const rightCtx = rightJoystickCanvas.getContext('2d');

    leftJoystickCanvas.width = 175;
    leftJoystickCanvas.height = 175;
    rightJoystickCanvas.width = 175;
    rightJoystickCanvas.height = 175;

    function drawJoystick(ctx, x, y, positionElement) {
        const centerX = 87.5; // Center adjusted for 175x175 canvas
        const centerY = 87.5; // Center adjusted for 175x175 canvas
        const radius = 70; // Adjusted radius to fit within the canvas

        // Clear the canvas
        ctx.clearRect(0, 0, 175, 175);

        // Draw the outer circle
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Draw centered crosshair
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - radius, centerY);
        ctx.lineTo(centerX + radius, centerY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - radius);
        ctx.lineTo(centerX, centerY + radius);
        ctx.stroke();

        // Draw line from current position to center
        ctx.strokeStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.stroke();

        // Draw joystick position circle
        ctx.fillStyle = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)) <= 7 ? 'green' : 'red'; // Adjusted proximity threshold
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2); // Circle size for better visibility
        ctx.fill();

        // Update the position text under the joystick
        const normalizedX = (x - centerX) / radius;
        const normalizedY = (y - centerY) / radius;
        positionElement.textContent = `X: ${normalizedX.toFixed(3)}, Y: ${normalizedY.toFixed(3)}`;
    }

    function updateJoysticks() {
        const gamepads = navigator.getGamepads();

        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (gp) {
                drawJoystick(leftCtx, gp.axes[0] * 70 + 87.5, gp.axes[1] * 70 + 87.5, leftJoystickPosition);
                drawJoystick(rightCtx, gp.axes[2] * 70 + 87.5, gp.axes[3] * 70 + 87.5, rightJoystickPosition);
            }
        }
        requestAnimationFrame(updateJoysticks);
        
    }

    window.addEventListener('gamepadconnected', () => {
        console.log('Gamepad connected');
        requestAnimationFrame(updateJoysticks);
    });

    window.addEventListener('gamepaddisconnected', () => {
        console.log('Gamepad disconnected');
    });
});


    window.addEventListener('gamepadconnected', () => {
        console.log('Gamepad connected');
        requestAnimationFrame(updateJoysticks);
    });

    window.addEventListener('gamepaddisconnected', () => {
        console.log('Gamepad disconnected');
    });




// Close modal when the user clicks the button
document.getElementById("closeModalBtn").addEventListener("click", function () {
    this.disabled = true;  // Disable the button immediately when clicked
    setTimeout(() => {
        sendToTeams();  // Send data to Teams after a delay
        this.disabled = false;  // Re-enable the button after the function executes
    }, 2500);  // Delay in milliseconds
});


let vibeCheck = true;

function activateVibration() {
    if (!vibeCheck) return;  // Exit function if vibration is not allowed

    const gamepads = navigator.getGamepads();
    let gamepadFound = false;

    for (let i = 0; i < gamepads.length; i++) {
        const gamepad = gamepads[i];
        if (gamepad && gamepad.vibrationActuator) {
            console.log(`Gamepad with vibration actuator found at index ${i}:`, gamepad);
            gamepadFound = true;

            // Function to control vibration
            const controlVibration = () => {
                if (!vibeCheck) {
                    // Ensure vibration is stopped if check is disabled during a timeout
                    gamepad.vibrationActuator.playEffect("dual-rumble", {
                        duration: 0,
                        weakMagnitude: 0.0,
                        strongMagnitude: 0.0
                    });
                    return;
                }

                // Start vibration
                gamepad.vibrationActuator.playEffect("dual-rumble", {
                    startDelay: 0,
                    duration: 1000,
                    weakMagnitude: 1.0,
                    strongMagnitude: 1.0
                }).then(() => {
                    console.log(`Vibration started on gamepad at index ${i}.`);
                    // Stop and restart vibration with a delay
                    setTimeout(() => {
                        if (vibeCheck) {
                            controlVibration(); // Continue vibration
                        }
                    }, 3000); // Wait 2 seconds after stopping for 1 second
                }).catch(error => {
                    console.error(`Error managing vibration on gamepad at index ${i}:`, error);
                });
            };

            controlVibration(); // Start the vibration control loop
            break;
        }
    }

    if (!gamepadFound) {
        console.log("No gamepad with vibration actuator found.");
    }
}



function initializeCalResult() {
    // Check if 'CalResult' exists in localStorage
    if (localStorage.getItem('CalResult') === null) {
        // If not existent, set it to 'Fail'
        localStorage.setItem('CalResult', 'Fail');
    }
}



    function startVibration() {
        const gamepad = navigator.getGamepads()[0];

        if (gamepad) {
            if (gamepad.vibrationActuator) {
                gamepad.vibrationActuator.playEffect("dual-rumble", {
                    startDelay: 0,
                    duration: 2000, // Duration in milliseconds
                    weakMagnitude: 1.0, // Weak rumble intensity (0.0 to 1.0)
                    strongMagnitude: 1.0 // Strong rumble intensity (0.0 to 1.0)
                });
                console.log("Vibration started.");
            } else {
                console.error("Vibration actuator not supported on this gamepad.");
            }
        } else {
            console.error("No gamepad connected.");
        }
    }



// Mic

let audioContext, microphone, analyser, dataArray;

async function setupAudio() {
    if (!audioContext) {
        audioContext = new AudioContext();
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphone = audioContext.createMediaStreamSource(stream);
    } catch (error) {
        console.error("Error accessing the microphone:", error);
        throw error;  // Rethrow to handle it in the calling function
    }
}

function createAnalyser() {
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    let bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    microphone.connect(analyser);
}

function drawEqualizer() {
    let canvas = document.getElementById('equalizerCanvas');

    if (!analyser) {
        console.log('Analyser is not ready.');
        requestAnimationFrame(drawEqualizer);
        return;
    }

    requestAnimationFrame(drawEqualizer);
    analyser.getByteFrequencyData(dataArray);

    let ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgb(0, 0, 0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let barWidth = (canvas.width / dataArray.length) * 0.5; // Make bars narrower
    let barHeight;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
        barHeight = dataArray[i] * (canvas.height / 256); // Scale bar height to canvas
        ctx.fillStyle = 'rgb(0, 255, 0)'; // Set bar color to green
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 2; // Increase gap between bars
    }
}


async function setupAndDrawEqualizer() {
    try {
        await setupAudio();
        createAnalyser();

        // Make the canvas visible as soon as the audio setup is confirmed
        let canvas = document.getElementById('equalizerCanvas');
        canvas.style.display = 'block';

        drawEqualizer();
    } catch (error) {
        console.error("Failed to start audio analysis:", error);
    }
}




function displayQuestion(test) {
    console.log(test.question);
    if (test.action) {
        test.action();
    }
}

// Example of calling the display function with the mic test
displayQuestion(tests[0]);



function sendToTeams() {
    const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
    });
    const currentDate = new Date();
    const formattedDate = formatter.format(currentDate);

    // Retrieve values from localStorage, with defaults for missing values
    const values = {
        workOrder: localStorage.getItem('workOrder') || 'Unknown',
        controller: localStorage.getItem('controllerType') || localStorage.getItem('gamepad_0'),
        preCalAxes: localStorage.getItem('preCalJoystick') || 'Unknown',
        postCalAxes: localStorage.getItem('postCalJoystick') || 'Unknown',
        calResult: localStorage.getItem('CalResult') || 'Fail',  // Default to 'Fail' if not set
        oqcResult: localStorage.getItem('oqcResult') || 'Unknown',  // Default to 'Unknown' if not set
        buttonCheck: localStorage.getItem("buttonsCheck") || 'Unknown',
        joystickCheck: localStorage.getItem("Joysticks") || 'Unknown',
        housingCheck: localStorage.getItem("Housing") || 'Unknown',
        ledCheck: localStorage.getItem("LEDs") || 'Unknown',
        adaptiveTriggerCheck: localStorage.getItem("Triggers") || 'Unknown',
        vibration: localStorage.getItem('Vibration') || 'Unknown',
        mic: localStorage.getItem('MicCheck') || 'Unknown',
        touchpad : localStorage.getItem('Touchpad') || 'Unknown'
    };

    // Constructing the JSON payload for the webhook
    const message = {
        WorkOrder: values.workOrder,
        Controller: values.controller,
        Date: formattedDate,
        CalibrationResult: values.calResult,
        OQCResult: values.oqcResult,
        PreCalibrationAxes: values.preCalAxes,
        PostCalibrationAxes: values.postCalAxes,
        Buttons: values.buttonCheck,
        Joysticks: values.joystickCheck,
        Housing: values.housingCheck,
        LEDs: values.ledCheck,
        AdaptiveTriggers: values.adaptiveTriggerCheck,
        Vibration: values.vibration,
        mic: values.mic,
        touchpad: values.touchpad
    };

    console.log("Sending the following data to the webhook:", message);

    const webhookUrl = "https://prod-130.westus.logic.azure.com:443/workflows/0a7e2bc646204baaafe0fb0b42292f7e/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=ShiFc_Y9jnU9fStql3GHLwzJUVfcovjYc6SKjXog8kA";
    fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(message)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(data => {
            console.log('Success:', data);
            window.location.reload();
        })
        .catch((error) => {
            console.error('Error during fetch:', error);
        });
}

async function sendOutputReport(device, reportId, data) {
    try {
        await device.sendReport(reportId, new Uint8Array(data));
        console.log("Output report sent.");
    } catch (error) {
        console.error("Error sending output report:", error);
    }
}



function saveJoystickReadings() {
    const gamepads = navigator.getGamepads();
    if (gamepads[0]) { // Assuming the first gamepad is the one you're interested in
        const gp = gamepads[0];

        const joystickReadings = {
            "Left Stick": [gp.axes[0].toFixed(6), gp.axes[1].toFixed(6)],
            "Right Stick": [gp.axes[2].toFixed(6), gp.axes[3].toFixed(6)]
        };

        // Convert the joystick readings to a JSON string before saving
        localStorage.setItem('postCalJoystick', JSON.stringify(joystickReadings));
        console.log("Joystick readings saved:", joystickReadings);
    } else {
        console.log("No gamepad detected.");
    }
}




function updateGamepad() {
    // Get all connected gamepads
    var gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

    for (var i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {  // Checking if gamepad at any index is connected
            return gamepads[i];
        }
    }
    return null; // Return null if no gamepad is connected
}



    function formatDate(date) {
        let day = date.getDate();
        let month = date.getMonth() + 1; // Months are zero-indexed in JavaScript
        let year = date.getFullYear().toString().slice(-2); // Get last two digits of the year
        let hours = date.getHours();
        let minutes = date.getMinutes();

        // Pad the day and month with leading zeros if necessary
        day = day < 10 ? '0' + day : day;
        month = month < 10 ? '0' + month : month;
        hours = hours < 10 ? '0' + hours : hours;
        minutes = minutes < 10 ? '0' + minutes : minutes;

        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    // Get current date and time
    const now = new Date();

    // Format and display the date and time
    console.log(formatDate(now));



    //dymo
    function printLabel() {




        let woLabel = localStorage.getItem("workOrder");
        let contLabel = localStorage.getItem("shortController");
        let resultLabel = localStorage.getItem("result");
        let dateLabel = formatDate(now);

        // Load the label XML template
        let labelXml = getLabelXml();
        let label = dymo.label.framework.openLabelXml(labelXml);

        // Check if the items exist in localStorage and are not null
        if (woLabel) {
            label.setObjectText("workOrder", woLabel);
        }
        if (contLabel) {
            label.setObjectText("controller", contLabel);
        }
        if (resultLabel) {
            label.setObjectText("result", resultLabel);
        }
        if (dateLabel) {
            label.setObjectText("date", dateLabel);
        }
        // Print the label
        printToPrinter(label);
    }

    function printToPrinter(label) {
        // Get all connected DYMO printers
        let printers = dymo.label.framework.getPrinters();
        if (printers.length == 0) throw "No DYMO printers are installed.";

        let printerName = "";
        for (let i = 0; i < printers.length; i++) {
            let printer = printers[i];
            if (printer.printerType == "LabelWriterPrinter") {
                printerName = printer.name;
                break;
            }
        }

        if (printerName === "") {
            throw "No LabelWriter printers found.";
        }

        // Print the label
        label.print(printerName);
    }





    function getLabelXml() {
        return `<?xml version="1.0" encoding="utf-8"?>
<DesktopLabel Version="1">
  <DYMOLabel Version="3">
    <Description>DYMO Label</Description>
    <Orientation>Landscape</Orientation>
    <LabelName>Small1738541</LabelName>
    <InitialLength>0</InitialLength>
    <BorderStyle>SolidLine</BorderStyle>
    <DYMORect>
      <DYMOPoint>
        <X>0.09</X>
        <Y>0.05666666</Y>
      </DYMOPoint>
      <Size>
        <Width>1.976667</Width>
        <Height>0.9033334</Height>
      </Size>
    </DYMORect>
    <BorderColor>
      <SolidColorBrush>
        <Color A="1" R="0" G="0" B="0"></Color>
      </SolidColorBrush>
    </BorderColor>
    <BorderThickness>1</BorderThickness>
    <Show_Border>False</Show_Border>
    <DynamicLayoutManager>
      <RotationBehavior>ClearObjects</RotationBehavior>
      <LabelObjects>
        <TextObject>
          <Name>workOrder</Name>
          <Brushes>
            <BackgroundBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BackgroundBrush>
            <BorderBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BorderBrush>
            <StrokeBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </StrokeBrush>
            <FillBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </FillBrush>
          </Brushes>
          <Rotation>Rotation0</Rotation>
          <OutlineThickness>1</OutlineThickness>
          <IsOutlined>False</IsOutlined>
          <BorderStyle>SolidLine</BorderStyle>
          <Margin>
            <DYMOThickness Left="0" Top="0" Right="0" Bottom="0" />
          </Margin>
          <HorizontalAlignment>Left</HorizontalAlignment>
          <VerticalAlignment>Middle</VerticalAlignment>
          <FitMode>None</FitMode>
          <IsVertical>False</IsVertical>
          <FormattedText>
            <FitMode>None</FitMode>
            <HorizontalAlignment>Left</HorizontalAlignment>
            <VerticalAlignment>Middle</VerticalAlignment>
            <IsVertical>False</IsVertical>
            <LineTextSpan>
              <TextSpan>
                <Text>ABC</Text>
                <FontInfo>
                  <FontName>Segoe UI</FontName>
                  <FontSize>12</FontSize>
                  <IsBold>True</IsBold>
                  <IsItalic>False</IsItalic>
                  <IsUnderline>False</IsUnderline>
                  <FontBrush>
                    <SolidColorBrush>
                      <Color A="1" R="0" G="0" B="0"></Color>
                    </SolidColorBrush>
                  </FontBrush>
                </FontInfo>
              </TextSpan>
            </LineTextSpan>
          </FormattedText>
          <ObjectLayout>
            <DYMOPoint>
              <X>0.09999987</X>
              <Y>0.09254875</Y>
            </DYMOPoint>
            <Size>
              <Width>1.052675</Width>
              <Height>0.2280145</Height>
            </Size>
          </ObjectLayout>
        </TextObject>
        <TextObject>
          <Name>date</Name>
          <Brushes>
            <BackgroundBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BackgroundBrush>
            <BorderBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BorderBrush>
            <StrokeBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </StrokeBrush>
            <FillBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </FillBrush>
          </Brushes>
          <Rotation>Rotation0</Rotation>
          <OutlineThickness>1</OutlineThickness>
          <IsOutlined>False</IsOutlined>
          <BorderStyle>SolidLine</BorderStyle>
          <Margin>
            <DYMOThickness Left="0" Top="0" Right="0" Bottom="0" />
          </Margin>
          <HorizontalAlignment>Right</HorizontalAlignment>
          <VerticalAlignment>Middle</VerticalAlignment>
          <FitMode>AlwaysFit</FitMode>
          <IsVertical>False</IsVertical>
          <FormattedText>
            <FitMode>AlwaysFit</FitMode>
            <HorizontalAlignment>Right</HorizontalAlignment>
            <VerticalAlignment>Middle</VerticalAlignment>
            <IsVertical>False</IsVertical>
            <LineTextSpan>
              <TextSpan>
                <Text>ABC</Text>
                <FontInfo>
                  <FontName>Segoe UI</FontName>
                  <FontSize>9.6</FontSize>
                  <IsBold>False</IsBold>
                  <IsItalic>False</IsItalic>
                  <IsUnderline>False</IsUnderline>
                  <FontBrush>
                    <SolidColorBrush>
                      <Color A="1" R="0" G="0" B="0"></Color>
                    </SolidColorBrush>
                  </FontBrush>
                </FontInfo>
              </TextSpan>
            </LineTextSpan>
          </FormattedText>
          <ObjectLayout>
            <DYMOPoint>
              <X>1.082119</X>
              <Y>0.1155267</Y>
            </DYMOPoint>
            <Size>
              <Width>0.9540944</Width>
              <Height>0.1820586</Height>
            </Size>
          </ObjectLayout>
        </TextObject>
        <TextObject>
          <Name>controller</Name>
          <Brushes>
            <BackgroundBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BackgroundBrush>
            <BorderBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BorderBrush>
            <StrokeBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </StrokeBrush>
            <FillBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </FillBrush>
          </Brushes>
          <Rotation>Rotation0</Rotation>
          <OutlineThickness>1</OutlineThickness>
          <IsOutlined>False</IsOutlined>
          <BorderStyle>SolidLine</BorderStyle>
          <Margin>
            <DYMOThickness Left="0" Top="0" Right="0" Bottom="0" />
          </Margin>
          <HorizontalAlignment>Center</HorizontalAlignment>
          <VerticalAlignment>Middle</VerticalAlignment>
          <FitMode>AlwaysFit</FitMode>
          <IsVertical>False</IsVertical>
          <FormattedText>
            <FitMode>AlwaysFit</FitMode>
            <HorizontalAlignment>Center</HorizontalAlignment>
            <VerticalAlignment>Middle</VerticalAlignment>
            <IsVertical>False</IsVertical>
            <LineTextSpan>
              <TextSpan>
                <Text>ABC</Text>
                <FontInfo>
                  <FontName>Segoe UI</FontName>
                  <FontSize>11.7</FontSize>
                  <IsBold>False</IsBold>
                  <IsItalic>False</IsItalic>
                  <IsUnderline>False</IsUnderline>
                  <FontBrush>
                    <SolidColorBrush>
                      <Color A="1" R="0" G="0" B="0"></Color>
                    </SolidColorBrush>
                  </FontBrush>
                </FontInfo>
              </TextSpan>
            </LineTextSpan>
          </FormattedText>
          <ObjectLayout>
            <DYMOPoint>
              <X>0.1178922</X>
              <Y>0.3914579</Y>
            </DYMOPoint>
            <Size>
              <Width>1.85843</Width>
              <Height>0.2218881</Height>
            </Size>
          </ObjectLayout>
        </TextObject>
        <TextObject>
          <Name>result</Name>
          <Brushes>
            <BackgroundBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BackgroundBrush>
            <BorderBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BorderBrush>
            <StrokeBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </StrokeBrush>
            <FillBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </FillBrush>
          </Brushes>
          <Rotation>Rotation0</Rotation>
          <OutlineThickness>1</OutlineThickness>
          <IsOutlined>False</IsOutlined>
          <BorderStyle>SolidLine</BorderStyle>
          <Margin>
            <DYMOThickness Left="0" Top="0" Right="0" Bottom="0" />
          </Margin>
          <HorizontalAlignment>Center</HorizontalAlignment>
          <VerticalAlignment>Middle</VerticalAlignment>
          <FitMode>AlwaysFit</FitMode>
          <IsVertical>False</IsVertical>
          <FormattedText>
            <FitMode>AlwaysFit</FitMode>
            <HorizontalAlignment>Center</HorizontalAlignment>
            <VerticalAlignment>Middle</VerticalAlignment>
            <IsVertical>False</IsVertical>
            <LineTextSpan>
              <TextSpan>
                <Text>ABC</Text>
                <FontInfo>
                  <FontName>Segoe UI</FontName>
                  <FontSize>16.2</FontSize>
                  <IsBold>True</IsBold>
                  <IsItalic>False</IsItalic>
                  <IsUnderline>False</IsUnderline>
                  <FontBrush>
                    <SolidColorBrush>
                      <Color A="1" R="0" G="0" B="0"></Color>
                    </SolidColorBrush>
                  </FontBrush>
                </FontInfo>
              </TextSpan>
            </LineTextSpan>
          </FormattedText>
          <ObjectLayout>
            <DYMOPoint>
              <X>0.5708333</X>
              <Y>0.613346</Y>
            </DYMOPoint>
            <Size>
              <Width>0.9883334</Width>
              <Height>0.3029916</Height>
            </Size>
          </ObjectLayout>
        </TextObject>
      </LabelObjects>
    </DynamicLayoutManager>
  </DYMOLabel>
  <LabelApplication>Blank</LabelApplication>
  <DataTable>
    <Columns></Columns>
    <Rows></Rows>
  </DataTable>
</DesktopLabel>`;
    }

    
