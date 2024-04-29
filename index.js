// get createDevice from CDN
const { createDevice, TimeNow, MessageEvent }  = RNBO;

const SAMPLES = {"sean": "media/sean-excitarse.wav"};
let audioRate = 1.0;
let samplePos = 0;
let lastSamplePos = 0;

//create the AudioContext
let WAContext = window.AudioContext || window.webkitAudioContext;
let context = new WAContext();

const setup = async () => {

    //fetch patcher
    let rawPatcher = await fetch("export/patch.export.json");
    let patcher = await rawPatcher.json();

    //call the library
    const device = await RNBO.createDevice({context, patcher});

    makeSliders(device);

    await loadSamples(device);

    device.MessageEvent.subscribe((ev) => {
        if (ev.tag === "out3"){
            samplePos = ev.payload;
        }

    });

    document.body.onclick = () => {
        context.resume(); 
    }

    let startButton = document.getElementById("start");
    let pauseButton = document.getElementById("pause");
    let stopButton = document.getElementById("stop");

    addButtonListener(device, startButton,pauseButton,stopButton);
    
    device.node.connect(context.destination);

}

function addButtonListener(device, startButton, pauseButton, stopButton){
    startButton.addEventListener("click", () =>{
        const play = new MessageEvent(TimeNow, "in2", [audioRate]);
        const bang = new MessageEvent(TimeNow, "in1", [1]);
        device.scheduleEvent(play);
        device.scheduleEvent(bang);

    });

    pauseButton.addEventListener("click", () =>{
        audioRate = device.parametersById.get("rate").value;
        lastSamplePos = samplePos;
        const pause = new MessageEvent(TimeNow, "in3", [1]);
        device.scheduleEvent(pause);
    });

    stopButton.addEventListener("click", () =>{
        const stop = new MessageEvent(TimeNow, "in3", [1]);
        device.scheduleEvent(stop);
        lastSamplePos = 0;
        
    });
}

async function loadSamples(device){
    for (let id in SAMPLES){
        const url = SAMPLES[id];
        await loadSample(url,id,device);
    }
    enableButtons();
}

function enableButtons(){
    let buttons = document.querySelectorAll("button");

    for (let button of buttons){
        button.removeAttribute("disabled");
    }
}

async function loadSample(url,id,device){
    //load audio to buffer
   const fileResponse = await fetch(url);
   const arrayBuf = await fileResponse.arrayBuffer();

   //decode audio
   const audioBuf = await context.decodeAudioData(arrayBuf);
   await device.setDataBuffer(id,audioBuf);
   

}

function makeSliders(device) {
    let pdiv = document.getElementById("rnbo-parameter-sliders");
    let noParamLabel = document.getElementById("no-param-label");
    if (noParamLabel && device.numParameters > 0) pdiv.removeChild(noParamLabel);

    // This will allow us to ignore parameter update events while dragging the slider.
    let isDraggingSlider = false;
    let uiElements = {};

    device.parameters.forEach(param => {
        // Subpatchers also have params. If we want to expose top-level
        // params only, the best way to determine if a parameter is top level
        // or not is to exclude parameters with a '/' in them.
        // You can uncomment the following line if you don't want to include subpatcher params
        
        //if (param.id.includes("/")) return;

        // Create a label, an input slider and a value display
        let label = document.createElement("label");
        let slider = document.createElement("input");
        let text = document.createElement("input");
        let sliderContainer = document.createElement("div");
        sliderContainer.appendChild(label);
        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(text);

        // Add a name for the label
        label.setAttribute("name", param.name);
        label.setAttribute("for", param.name);
        label.setAttribute("class", "param-label");
        label.textContent = `${param.name}: `;

        // Make each slider reflect its parameter
        slider.setAttribute("type", "range");
        slider.setAttribute("class", "param-slider");
        slider.setAttribute("id", param.id);
        slider.setAttribute("name", param.name);
        slider.setAttribute("min", param.min);
        slider.setAttribute("max", param.max);
        if (param.steps > 1) {
            slider.setAttribute("step", (param.max - param.min) / (param.steps - 1));
        } else {
            slider.setAttribute("step", (param.max - param.min) / 1000.0);
        }
        slider.setAttribute("value", param.value);

        // Make a settable text input display for the value
        text.setAttribute("value", param.value.toFixed(1));
        text.setAttribute("type", "text");

        // Make each slider control its parameter
        slider.addEventListener("pointerdown", () => {
            isDraggingSlider = true;
        });
        slider.addEventListener("pointerup", () => {
            isDraggingSlider = false;
            slider.value = param.value;
            text.value = param.value.toFixed(1);
        });
        slider.addEventListener("input", () => {
            let value = Number.parseFloat(slider.value);
            param.value = value;
        });

        // Make the text box input control the parameter value as well
        text.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
                let newValue = Number.parseFloat(text.value);
                if (isNaN(newValue)) {
                    text.value = param.value;
                } else {
                    newValue = Math.min(newValue, param.max);
                    newValue = Math.max(newValue, param.min);
                    text.value = newValue;
                    param.value = newValue;
                }
            }
        });

        // Store the slider and text by name so we can access them later
        uiElements[param.id] = { slider, text };

        // Add the slider element
        pdiv.appendChild(sliderContainer);
    });

    // Listen to parameter changes from the device
    device.parameterChangeEvent.subscribe(param => {
        if (!isDraggingSlider)
            uiElements[param.id].slider.value = param.value;
        uiElements[param.id].text.value = param.value.toFixed(1);
    });
}

window.addEventListener("load",setup,false);