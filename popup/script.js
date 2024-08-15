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

function removeValue(key) {
	return toPromise((resolve, reject) => {
		chrome.storage.local.remove(key, () => {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
			}
			resolve();
		});
	});
}


async function getDataFromHtml(html) {
	let selectedLocations = await getValue('locations');

	if (!selectedLocations) {
		selectedLocations = [];
	}

	const data = {
		selectedLocations: [],
		locations: [],
	};
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');
	const offerLayouts = doc.querySelectorAll('.offerLayout');

	data.selectedLocations = selectedLocations;
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
			selected: selectedLocations.includes(place.textContent.trim()),
		};
	});

	return data;
}

function addLocation(location) {
	const locationListItem = document.createElement('li');
	const locationTitle = document.createElement('a');
	const locationRemoveButton = document.createElement('span');
	const locationContent = document.createElement('div');

	locationTitle.className = 'uk-accordion-title location-title';
	locationTitle.textContent = `${location.name}`;

	locationRemoveButton.className = 'uk-badge remove-button';
	locationRemoveButton.textContent = 'Remove';

	locationTitle.appendChild(locationRemoveButton);
	locationListItem.appendChild(locationTitle);

	locationContent.className = 'uk-accordion-content container uk-padding-small';
	locationListItem.appendChild(locationContent);


	location.offers.forEach((item) => {
		const lineElement = document.createElement('hr');
		const offerElement = document.createElement('div');

		offerElement.className = 'offer';
		offerElement.textContent = `${item.name}`;
		offerElement.setAttribute('location', `${location.name}`);
		lineElement.setAttribute('location', `${location.name}`);
		locationContent.appendChild(offerElement);
		locationContent.appendChild(lineElement);

		if (item.price) {
			addBadge(offerElement, 'badge-price', item.price.amountText);
		}

		addFoodBadges(offerElement, item.name);
	});

	return locationListItem;
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

chrome.runtime.sendMessage({
	action: 'getData',
}, async response => {
	console.log('response', response);
	const data = await getDataFromHtml(response.payload.html);
	console.log('dataFromHtml', data);

	let selectedLocations = data.selectedLocations;
	const locationListElement = document.getElementById('location-select-list-ul');
	const selectedLocationsElement = document.getElementById('selected-locations');
	const locationSearchElement = document.getElementById('location-search');
	const resetButtonElement = document.getElementById('reset-button');

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
		const locationTasksOptionElement = document.createElement('li');
		const optionLabelElement = document.createElement('a');

		optionLabelElement.className = 'location-option uk-dropdown-close';
		optionLabelElement.textContent = `${locationOption.name}`;
		optionLabelElement.href = '#';
		optionLabelElement.setAttribute('search', `${locationOption.name}`);

		optionLabelElement.addEventListener('click', async () => {
			if (!selectedLocations.includes(locationOption.name)) {
				const locationListItem = addLocation(locationOption);
				selectedLocationsElement.appendChild(locationListItem);

				selectedLocations = [...selectedLocations, locationOption.name];
				await setValue('locations', selectedLocations);

				locationListItem.children[0].children[0].addEventListener('click', async () => {
					selectedLocations = selectedLocations.filter((location) => {
						return location !== locationOption.name;
					});
					await setValue('locations', selectedLocations);
					locationListItem.remove();
				});
			}
		});

		locationTasksOptionElement.appendChild(optionLabelElement);
		locationListElement.appendChild(locationTasksOptionElement);

		if (locationOption.selected) {
			const locationListItem = addLocation(locationOption);

			selectedLocationsElement.appendChild(locationListItem);

			locationListItem.children[0].children[0].addEventListener('click', async () => {
				selectedLocations = selectedLocations.filter((location) => {
					return location !== locationOption.name;
				});
				await setValue('locations', selectedLocations);
				locationListItem.remove();
			});
		}
	});

	if (selectedLocations.length > 0) {
		selectedLocationsElement.children[0].className += ' uk-open';
	}

	resetButtonElement.addEventListener('click', async () => {
		selectedLocationsElement.innerHTML = '';
		selectedLocations = [];
		await removeValue('locations');
	});
});
