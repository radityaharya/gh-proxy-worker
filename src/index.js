import querystring from 'querystring'

const VALID_USERNAME = ["radityaharya"]
const CACHE_PREFIX = "CACHE"
const CACHE_TIME_MINUTES = 60

export default {
	async fetch(request, env) {
		console.log(request.url)
		if (request.url.endsWith("/list")) {
			var list = await env.MY_BUCKET.list()
			return new Response(JSON.stringify(list))
		}
		const response = await cache(request, env)
		return response
	}
}


async function cache(request, env) {
	const BUCKET = env.MY_BUCKET
	const url = request.url
	const isMinified = url.includes("/min/")
	const filename = url.substring(url.lastIndexOf('/') + 1).split("?")[0]
	const cacheKey = CACHE_PREFIX +"-"+(isMinified ? "min" : "raw") +"."+ filename
	const contentType = url.endsWith(".js") ? "application/javascript" : url.endsWith(".css") ? "text/css" : "text/plain"
	const cache = await BUCKET.get(cacheKey)
	var result = null
	var isCache = false
	if (cache) {
		if (Date.now() - cache.uploaded < CACHE_TIME_MINUTES * 60 * 1000) {
			var result = await cache.text()
			var isCache = true
		} else{
			var isCache = false
		}
	} 
	if (!isCache) {
		try {
			result = await handleRequest(request).then(res => res.text())
		}
		catch (e) {
			var result = await cache.text()
			var error = e
		}
		var isCache = false
	}
	if (result) {
		if (!isCache) {
			BUCKET.put(cacheKey, result, {
				httpMetadata: {
					"Content-Type": contentType,
				}
			})
		}
		var headers = {
			"Content-Type": contentType,
			"Cache-Control": "public, max-age=" + CACHE_TIME_MINUTES * 60,
			"IsCached": isCache,
		}
		if (isCache) {
			headers["Upload-Date"] = cache.uploaded
			headers["Age"] = Math.floor((Date.now() - cache.uploaded) / 1000)
		}
		if (error) {
			headers["Error"] = error
		}
		return new Response(result, {
			status: 200,
			headers: headers
		})
	}
	return new Response('Not found', { status: 404 })
}

async function minify(response) {
	if (response.url.endsWith(".js") || response.url.endsWith(".css")) {
		const query = querystring.stringify({
			input: await response.text()
		});

		const req = await fetch('https://www.toptal.com/developers/' + (response.url.endsWith(".js") ? 'javascript-minifier' : 'cssminifier') + '/api/raw', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': query.length
			},
			body: query
		});
		return req
	}
	return response
}

async function handleRequest(request) {
	var isMin = false
	var url = new URL(request.url)
	var path = url.pathname.split("/")
	if (path[1] == "min") {
		isMin = true
		path.shift()
	}
	path.shift()
	var username = path[0]
	var repo = path[1]
	var branch = path[2]
	var file = path.slice(3).join("/")
	if (VALID_USERNAME.includes(username)) {
		const response = await fetch(`https://raw.githubusercontent.com/${username}/${repo}/${branch}/${file}`)
		if (response.ok) {
			if (isMin) {
				return await minify(response)
			} else {
				return response
			}
		} else {
			return "Not found"
		}
	}
	return "Not Found"
}