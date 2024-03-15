import calcDuration from "./utils/calcDuration.js";
import zeroPad from "./utils/zeroPad.js";
class TimeDuration extends HTMLElement {
    static get observedAttributes() {
        return ['start', 'end', 'format', 'duration', 'hours'];
    }

    constructor() {
      super();
  
      this.start = null;
      this.end = null;
      this.format = 'standard';
  
      this.render();
    }
  
    connectedCallback() {
      this.addEventListener('click', this.toggleFormat.bind(this));
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.toggleFormat.bind(this));
    }
  
    render() {
      this.innerHTML = this.formattedTime
         
    }
    
    get formattedTime() {
        const {start, end, duration, format} = this;
      if (format === 'standard') {
        return formatDurationToStandard({ start, end, duration });
      } else {
        return calcDuration({ start, end, duration });
      }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
          case 'hours':
            console.log(newValue);
            this.duration = Math.round(parseFloat(newValue) * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND);
            console.log(this.duration);
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
  
    toggleFormat() {
      this.format = this.format === 'standard'? 'decimal' : 'standard';
      this.render();
    }
  }
  
  customElements.define('time-duration', TimeDuration);

  const MILLISECONDS_PER_SECOND = 1000;
  const SECONDS_PER_MINUTE = 60
  const MINUTES_PER_HOUR = 60

  /**
 * Formats a duration between two dates as a string in the standard format of "HH:mm".
 * @param {{start: Date, end: Date}} duration - The duration to format, represented as an object with start and end properties, both of type Date.
 * @returns {string} The formatted duration, with a negative sign if the duration is negative.
 */
  function formatDurationToStandard ({ start = null, end = null, duration = null }) {
    const milliseconds  = duration || (start && end ?  end.getTime() - start.getTime() : 0);
   return `${milliseconds < 0 ? '-' : ''} ${Math.floor(millisecondsToHours(milliseconds))}:${zeroPad(2, getRemainingMinutes(milliseconds))}:${zeroPad(2, getRemainingSeconds(milliseconds))}`

  }

  function millisecondsToHours(milliseconds) {
    return Math.floor(milliseconds / MILLISECONDS_PER_SECOND / SECONDS_PER_MINUTE / MINUTES_PER_HOUR);
  }

  function getRemainingMinutes(milliseconds) {
    return Math.floor(milliseconds / MILLISECONDS_PER_SECOND / SECONDS_PER_MINUTE) % MINUTES_PER_HOUR;
  }

  function getRemainingSeconds(milliseconds) {
    return Math.floor(milliseconds / MILLISECONDS_PER_SECOND ) % SECONDS_PER_MINUTE;
  }