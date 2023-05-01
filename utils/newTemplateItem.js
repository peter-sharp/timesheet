export default function newtemplateItem(template) {
    const el = template.content.cloneNode(true)
    return el.children.length > 1 ? el : el.firstElementChild
}