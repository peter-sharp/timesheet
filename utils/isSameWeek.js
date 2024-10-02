
export default function isSameWeek(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000; // one day in milliseconds
    const dayOfWeek = date1.getDay(); // get the day of the week of the first date
    const firstDayOfWeek = new Date(date1.getTime() - dayOfWeek * oneDay); // get the first day of the week
    const lastDayOfWeek = new Date(firstDayOfWeek.getTime() + 6 * oneDay); // get the last day of the week

    // check if the second date is between the first and last day of the week
    return date2 >= firstDayOfWeek && date2 <= lastDayOfWeek  && date1.getFullYear() == date2.getFullYear();
}
