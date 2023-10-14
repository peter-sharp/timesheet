export default function subMonth(date, months) {
    const newDate = new Date(date)
     newDate.setMonth( date.getMonth() - months);
     return newDate
 }