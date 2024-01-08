const template = document.createElement('template')

template.innerHTML = `
<style>
    :host {
        width: 1em;
        height: 1em;
    }
    svg {
        background-color: var(--bg-color, #aaa);
        border-radius: 50%;
        padding: 0.2em
    }

    path {
        fill: var(--fill-color, #0f3);
    }
</style>
<svg width="0.6em" height="0.6em" viewbox="-1 -1 2 2" style="transform: rotate(-90deg)">
    <path><path/>
</svg>
`

function updatePath(path, percent) {
    path.setAttribute('d', getPathData(percent))
}

function getPathData(percent) {
    const [startX, startY] = getCoordinatesForPercent(0)
    const [endX, endY] = getCoordinatesForPercent(percent)

    const largeArcFlag = percent > 0.5 ? 1 : 0

    return [
        `M ${startX} ${startY}`,
        `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
        `L 0 0`
    ].join(' ')
}

function getCoordinatesForPercent(percent) {
    const x = Math.cos(2 * Math.PI * percent)
    const y = Math.sin(2 * Math.PI * percent)

    return [x, y]
}

/**
 * @see https://hackernoon.com/a-simple-pie-chart-in-svg-dbdd653b6936
 */
class PieProgressIndicator extends HTMLElement {
    static get is() {return 'pie-progress'}
    static get observedAttributes() {return ['percent']}

    constructor() {
        super()

        const shadow = this.attachShadow({mode: 'open'})
        const templateContent = template.content

        shadow.appendChild(templateContent.cloneNode(true))

        const path = shadow.querySelector('path')
        
        this.updatePath = function(){
          updatePath(path, this.getAttribute('percent'))
        }
      
    }
  
    connectedCallback() {
      this.updatePath()
    }
  
    attributeChangedCallback() {
      this.updatePath()
    }

}


customElements.define(PieProgressIndicator.is, PieProgressIndicator)

export default PieProgressIndicator