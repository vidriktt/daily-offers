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
		chrome.storage.local.set({[key]: value}, () => {
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
	action: 'getData',
}, async response => {
	console.log('response', response);
	const data = await getDataFromHtml(response.payload.html);
	console.log('dataFromHtml', data);

	const locationButtonElement = document.getElementById('location-button');
	const locationListElement = document.getElementById('location-select-list-ul');
	const locationSearchElement = document.getElementById('location-search');
	const containerElement = document.getElementById('offers');

	locationSearchElement.addEventListener('input', async () => {
		const locationListElements = document.querySelectorAll('#location-select-list-ul a');
		const searchTerm = locationSearchElement.value.toLowerCase();

		locationListElements.forEach((item) => {
			const text = item.getAttribute('search').toLowerCase();

			if (text.includes(searchTerm)) {
				item.style.display = 'block';
			} else {
				item.style.display = 'none';
			}
		});
	});

	data.locations.forEach((locationOption) => {
		if (locationOption.default) {
			locationButtonElement.textContent = `${locationOption.name}`;
		}

		const locationTasksOptionElement = document.createElement('li');
		const optionLabelElement = document.createElement('a');

		optionLabelElement.className = 'location-option uk-dropdown-close';
		optionLabelElement.textContent = `${locationOption.name}`;
		optionLabelElement.href = '#';
		optionLabelElement.setAttribute('search', `${locationOption.name}`);

		optionLabelElement.addEventListener('click', async () => {
			locationButtonElement.textContent = `${locationOption.name}`;
			filterOffers(locationOption.name);
			await setValue('location', locationOption.name);
		});

		locationOption.offers.forEach((item) => {
			if (!item.price) {
				return;
			}

			const lineElement = document.createElement('hr');
			const offerElement = document.createElement('div');

			offerElement.className = 'offer';
			offerElement.textContent = `${item.name}`;
			offerElement.setAttribute('location', `${locationOption.name}`);
			lineElement.setAttribute('location', `${locationOption.name}`);
			containerElement.appendChild(offerElement);
			containerElement.appendChild(lineElement);

			addBadge(offerElement, 'badge-price', item.price.amountText);
			addFoodBadges(offerElement, item.name);
		});

		locationTasksOptionElement.appendChild(optionLabelElement);
		locationListElement.appendChild(locationTasksOptionElement);
	});

	filterOffers(data.selectedLocation);
});

function filterOffers(location) {
	const offerElements = [
		...document.querySelectorAll('#offers div'),
		...document.querySelectorAll('#offers hr')
	];

	offerElements.forEach((item) => {
		const text = item.getAttribute('location');

		if (!text || text === location) {
			item.style.display = 'block';
		} else {
			item.style.display = 'none';
		}
	});
}

function addFoodBadges(offerElement, offer) {
	[
		{food: 'kala', color: 'red'},
		{food: 'pangasius', color: 'red'},
		{food: 'lõhe', color: 'red'},
		{food: 'tilaapia', color: 'red'},
		{food: 'tursa', color: 'red'},
		{food: 'filee', color: 'orange'},
		{food: 'supp', color: 'blue'},
	].forEach(
		(option) => {
			if (offer.toLowerCase().includes(option.food)) {
				addBadge(offerElement, `badge-${option.color}`, option.food);
			}
		}
	);
}

function addBadge(offerElement, className, value) {
	const badgeElement = document.createElement('span');

	badgeElement.className = `uk-badge ${className}`
	badgeElement.textContent = `${value}`;
	offerElement.appendChild(badgeElement);
}
