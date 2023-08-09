var userSettings = {
    baseDuration: 60, //base timer duration
    subUpdate: { //timer updates for new subs
        subsThreshold: 1, //updateTimer each new {subsThreshold} subs,
        durationPerUpdate: 0.5 //the duration added for each sub update
    },
    durationPerDollar: 3 //the duration added for each dollar donated
}

class TimerApp {
    /** @type {Element} */
    #ElementReference;

    /**
     * Creates new timer
     * @param {String} selector the html selector for displaying the timer at
     */
    constructor(selector) {
        this.#ElementReference = document.querySelector(selector);
        this.subcount = new Subcount();
        //load time from memory or set it if none
        if (localStorage.startTime) {
            this.startTime = new Date(localStorage.startTime);
        } else {
            this.startTime = new Date();
            localStorage.startTime = this.startTime
        }
        this.ini()
    }

    set html(html) {
        this.#ElementReference.innerHTML = html;
    }

    get duration() {
        const totalDuration = userSettings.baseDuration * 60 + //base duration
            this.subcount.addedDuration; //time from new subs

        return (this.startTime - Date.now()) / 1000 + totalDuration
    }

    /**
     * Start load of the timer & ws connections
     */
    async ini() {
        this.html = "טוען טימר";
        await sleep(1000)
        this.updateInterval = setInterval(this.updateTimer.bind(this), 1000);
    }

    /** each sec update timer & if needed stop the timer loop */
    updateTimer() {
        const timeRemain = this.duration;
        //check if times up
        if (timeRemain < 0)
            clearInterval(this.updateInterval)

        const timeStr = format(timeRemain) //convert to string view
        const elements = [];
        //break down string view into html spans
        timeStr.split("").reverse().forEach(letter => {
            const span = document.createElement("span");
            span.innerHTML = letter;
            span.className = "number"
            if (isNaN(letter))
                span.className = "char"
            if (letter == ":")
                span.className = "dots"
            elements.push(span)
        })
        //for each existing DOM span - check if update needed
        this.#ElementReference.childNodes.forEach(((child, index, p) => {

            //if there is more DOM spans then needed
            if (elements.length < p.length - index)
                return child.remove();

            //if content is the same - keep;
            if (child.textContent == elements[index].innerHTML)
                return;

            child.replaceWith(elements[index])//if content miss-match replace with correct
        }))

        //if need to add new spans to DOM
        for (let i = this.#ElementReference.childNodes.length;
            i < elements.length; i++) {
            this.#ElementReference.appendChild(elements[i])
        }
    }
}

class Subcount {
    constructor() {
        this.startedAt = Number(localStorage.subsStartedAt) || 0;
        this.maxCount = Number(localStorage.subsMaxCount) || -1;
    }

    /**
     * updates each change in subcount
     * @param {Number} newCount 
     */
    update(newCount) {
        //initial values
        if (this.maxCount == -1) {
            this.startedAt = newCount;
            localStorage.subsStartedAt = newCount;
            this.maxCount = newCount;
            return;
        }
        //if new is less the max - exit as there is no update needed.
        if (newCount <= this.maxCount)
            return;

        const olderAddedDuration = this.addedDuration;
        this.maxCount = newCount; //updates subcount 
        localStorage.subsMaxCount = newCount;
        const newAddedDuration = this.addedDuration //will now calc with the added subs

        //if value didnt changed
        if (newAddedDuration == olderAddedDuration)
            return;

        //TODO: call GUI update of added values
    }

    /**
     * calcs the additive time from subcount
     * @returns {Number}
    */
    get addedDuration() {
        return Math.floor((this.maxCount - this.startedAt) / userSettings.subUpdate.subsThreshold) * userSettings.subUpdate.durationPerUpdate * 60
    }
}

/**
 * convert seconds into clock time string
 * @param {Number} time 
 * @returns {String}
 */
function format(time) {
    // Hours, minutes and seconds
    var hrs = ~~(time / 3600);
    var mins = ~~((time % 3600) / 60);
    var secs = ~~time % 60;

    // Output like "1:01" or "4:03:59" or "123:03:59"
    var ret = "";
    if (hrs > 0) {
        ret += "" + hrs + ":" + (mins < 10 ? "0" : "");
    }
    ret += "" + mins + ":" + (secs < 10 ? "0" : "");
    ret += "" + secs;

    if (time <= 0)
        ret = "סוף הלייב!".split("").reverse().join("");
    return ret;
}
const sleep = (ms) => new Promise((res) => setTimeout(res, ms))
var timer = new TimerApp("#counter");