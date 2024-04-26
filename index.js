// get createDevice from CDN
const { createDevice, TimeNow, MessageEvent }  = RNBO;


//create the AudioContext
let WAContext = window.AudioContext || window.webkitAudioContext;
let context = new WAContext();

const setup = async () => {

    let button = document.getElementById("button");
    //fetch patcher
    let rawPatcher = await fetch("export/patch.export.json");
    let patcher = await rawPatcher.json();

    //call the library
    const device = await RNBO.createDevice({context, patcher});

    makeSliders(device);

    document.body.onclick = () => {
        context.resume();
    }
    
    // // Optionally, you can create a gain node to control the level of your RNBO device
    // const gainNode = context.createGain();
    // gainNode.connect(context.destination);
    // // Assuming you've created a device already, you can connect its node to other web audio nodes
    // device.node.connect(gainNode);

    device.node.connect(context.destination);
    //connect audio input
    const handleSuccess = (stream) => {
        const source = context.createMediaStreamSource(stream);
        source.connect(device.node);
    }

    navigator.mediaDevices.getUserMedia({audio: true, video: false}).then(handleSuccess);
    let max = -1000;
    let min = 0;
    let pmin = document.getElementById("min");
    
    let pmax = document.getElementById("max");
    
    device.messageEvent.subscribe((ev) => {
        if (ev.tag === "out4"){
            let realLevel = ev.payload;
            if (realLevel > max){
                max = realLevel;
            }

            if (realLevel < min && realLevel > -100){
                min = realLevel;
            }

            pmin.textContent = min;
            pmax.textContent = max;
            console.log(ev.payload)
        }

        if (ev.tag === "out3"){
            let level = ev.payload;
            //console.log(level);
            let color = `hsl(${level}, 33%, 25%)`;
            //console.log(color);
            document.body.style.backgroundColor = color;
        
        }
    });

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

setup();