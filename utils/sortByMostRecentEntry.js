export default function sortByMostRecentEntry(a,b) {
    a.mostRecentEntry = new Date(a.mostRecentEntry);
    b.mostRecentEntry = new Date(b.mostRecentEntry);
    if(a.mostRecentEntry.getTime() > b.mostRecentEntry.getTime()) return -1;
    if(a.mostRecentEntry.getTime() < b.mostRecentEntry.getTime()) return 1;
    return 0;
}