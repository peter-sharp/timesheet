
export default function subWeek(date, weeks) {
    const oneDay = 24 * 60 * 60 * 1000; // one day in milliseconds
    const oneWeek = oneDay * 7;
    const newDate = new Date(date.getTime() - oneWeek * weeks);
     return newDate
 }