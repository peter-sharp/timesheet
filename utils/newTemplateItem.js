export default function newtemplateItem(template) {
    return template.content.cloneNode(true).firstElementChild
}