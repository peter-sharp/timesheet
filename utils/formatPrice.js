let formatPrice = Intl.NumberFormat("en-US", { style: 'currency', currency: 'USD' })
formatPrice = formatPrice.format.bind(formatPrice);

export default formatPrice