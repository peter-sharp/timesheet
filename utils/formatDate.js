let formatDate = new Intl.DateTimeFormat('en-US');
export default formatDate.format.bind(formatDate);
