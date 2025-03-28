import calcDuration, { formatDurationToStandard, hoursToMilliseconds } from "./utils/calcDuration.js";

class TimeDuration extends HTMLElement {
    static get observedAttributes() {
        return ['start', 'end', 'format', 'duration', 'hours'];
    }

    constructor() {
      super();
  
      this.start = null;
      this.end = null;
      this.format = 'standard';
      this.tootipFormat = 'decimal'
  
      this.render();
    }
  
   
  
    render() {
      this.innerHTML = this.formattedTime
      this.title = this.getFormattedTime({...this, format:  this.tootipFormat})
    }
    
    get formattedTime() {
        return this.getFormattedTime(this);
    }

    /**
     * 
     * @param {Date} start 
     * @param {Date} end 
     * @param {Integer} duration milliseconds 
     * @returns String
     */
    getFormattedTime({start, end, duration, format}) {
      if (format === 'standard') {
        return formatDurationToStandard({ start, end, duration });
      } else {
        return calcDuration({ start, end, duration });
      }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
          case 'hours':
            this.duration = Math.round(hoursToMilliseconds(parseFloat(newValue)));

            this.render();
            break;
          case 'duration':
            this.duration = parseFloat(newValue);
            this.render();
            break;
          case 'start':
            this.start = newValue? new Date(newValue) : null;
            this.render();
            break;
          case 'end':
            this.end = newValue? new Date(newValue) : null;
            this.render();
            break;
          case 'format':
            this.format = newValue;
            this.render();
            break;
          default:
            break;
        }
      }
  

  }
  
  customElements.define('time-duration', TimeDuration);
