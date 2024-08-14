function toPromise(callback) {
	return new Promise((resolve, reject) => {
		try {
			callback(resolve, reject);
		} catch (err) {
			reject(err);
		}
	});
}

function getValue(key) {
	return toPromise((resolve, reject) => {
		chrome.storage.local.get(key, (result) => {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
			}

			resolve(result[key]);
		});
	});
}

function setValue(key, value) {
	return toPromise((resolve, reject) => {
		chrome.storage.local.set({ [key]: value }, () => {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
			}

			resolve(value);
		});
	});
}

async function getDataFromHtml(html) {
	const selectedLocation = await getValue('location');
	const data = {
		selectedLocation,
		locations: [],
	};
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');
	const offerLayouts = doc.querySelectorAll('.offerLayout');

	data.locations = [...offerLayouts].map((offerLayout) => {
		const offerElements = offerLayout.querySelectorAll('.offer');
		const place = offerLayout.getElementsByTagName('h3')[0];

		const offers = [...offerElements].map((offer) => {
			const priceElement = offer.getElementsByTagName('strong')[0];
			let food = offer.textContent;
			let price = null;

			if (priceElement) {
				price = priceElement.textContent.trim();
				food = food.replace(` ${price}\n`, '').trim();
				price = {
					amount: parseFloat(price.replace(',', '.')),
					currency: price.replace(/[0-9,.]/g, '').trim(),
				}
				price.amountText = `${price.amount.toFixed(2)}${price.currency}`;
			}

			return {
				name: food,
				price,
			};
		});

		return {
			offers,
			name: place.textContent.trim(),
			default: selectedLocation === place.textContent.trim(),
		};
	});

	return data;
}

chrome.runtime.sendMessage({
	action: "getData",
}, async response => {
	console.log("response", response);
	const data = await getDataFromHtml(response.payload.html);
	console.log(data);
});
