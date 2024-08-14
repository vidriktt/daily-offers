chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	(async () => {
		const apiURL = 'https://xn--pevapakkumised-5hb.ee/tartu/';

		switch (request.action) {
			case "getData":
				try {
					const response = await fetch(`${apiURL}`, {
						method: 'GET',
					});
					const html = await response.text();
					await sendResponse({
						success: true,
						payload: {
							status: response.status,
							html,
							req: request.payload,
						}
					});
				} catch (error) {
					console.error(error);
					await sendResponse({
						success: false,
						payload: {
							error,
							message: error.message,
							req: request.payload,
						}
					});
				}
				break;
		}
	})();

	return true;
});
