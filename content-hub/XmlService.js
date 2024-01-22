a'use strict'
const prisma = require('../utils/client.js')
const helpers = require('../utils/helpers.js')

const {
	validateXmlBoolean,
	validateXmlObject,
} = require('./validation/SchemaValidationService.js')

const {deleteAssets} = require('./common/s3.js')

const {
	findFirstXmlIndex,
	findFirstWithAssetsXmlIndex,
	findUniqueXmlContent,
	findUniqueXmlForcedContent,
	findFirstWithXsdXmlIndex,
} = require('./common/queries.js')
const {xmlToHtmlService, xmlToPDFService} = require('./RenderingService.js')

const deleteXmlIndex = async (documentId) =>
	prisma.xml_index
		.delete({
			where: {
				id: documentId,
			},
		})
		.catch((err) => {
			throw err
		})

const updateXmlContent = async (documentId, xmlContent) =>
	await prisma.xml_content
		.update({
			where: {
				xml_id: documentId,
			},
			data: {
				content: xmlContent,
			},
		})
		.catch((err) => {
			throw err
		})

const updateXmlIndex = async (documentId, fields) =>
	await prisma.xml_index
		.update({
			where: {
				id: documentId,
			},
			data: {
				...fields,
			},
		})
		.catch((err) => {
			throw err
		})

const findManyPaginationXml = async (req) => {
	const {
		title,
		shortCode,
		status,
		locked,
		printYear,
		valid,
		pageNumber,
		pageSize,
	} = req.query
	const pageNo = Number(pageNumber) || 1
	const pageLength = Number(pageSize) || 10
	const skipCount = (pageNo - 1) * pageLength
	const takeCount = pageLength

	const filterExpression = Object.assign(
		title ? {title} : {},
		shortCode ? {version: shortCode} : {},
		status ? {status} : {},
		locked ? {lock_status: locked} : {},
		printYear ? {year: printYear} : {},
		valid ? {is_valid: valid} : {},
	)

	return await prisma.xml_index.findMany({
		skip: skipCount,
		take: takeCount,
		where: {
			...filterExpression,
		},
		orderBy: {
			title: 'asc',
		},
	})
}

const findFirstWithContentXsdIndex = async (ns_hash_val) =>
	prisma.xsd_index
		.findFirst({
			where: {
				ns_hash_val: {
					equals: ns_hash_val,
				},
			},
			include: {
				content: true,
			},
		})
		.catch((e) => {
			throw e
		})

const createWithContentXmlIndex = async (fields, xml) =>
	prisma.xml_index
		.create({
			data: {
				...fields,
				created_at: new Date(),
				updated_at: new Date(),
				xml_content: {
					create: {
						content: xml,
					},
				},
			},
			include: {
				xml_content: {
					select: {
						id: true,
						xml_id: true,
					},
				},
			},
		})
		.catch((e) => {
			if (e.code === 'P2002') {
				throw helpers.errorHandler(
					409,
					`documentId: ${fields.document_id} already exists, please choose another one`,
				)
			} else {
				throw e
			}
		})

const createWithContentForcedXmlIndex = async (fields, xml) =>
	prisma.xml_index
		.create({
			data: {
				...fields,
				created_at: new Date(),
				updated_at: new Date(),
				xml_content_forced: {
					create: {
						content: xml,
					},
				},
			},
			include: {
				xml_content_forced: {
					select: {
						id: true,
						xml_id: true,
						invalidation_reason: true,
					},
				},
			},
		})
		.catch((err) => {
			if (err.code === 'P2002') {
				throw helpers.errorHandler(
					409,
					'documentId already exists, please choose another one',
				)
			} else {
				throw err
			}
		})

const xmlRequestCheck = ({size, buffer}, params) => {
	const fileContent = buffer.toString()
	try {
		helpers.isValidXML(size, fileContent)
	} catch (err) {
		throw helpers.errorHandler(400, {...err, message: err.message})
	}

	const xmlDoc = helpers.parseXml(fileContent)
	const namespace = xmlDoc.root()?.namespace()?.href()
	const xmlTitle =
		xmlDoc.get('//xmlns:meta[@name="title"]', namespace)?.text() ||
		params.xmlTitle
	const version =
		xmlDoc.root()?.attr('schema-version')?.value() || params.version

	let errorMessage = ''

	if (!namespace) {
		errorMessage += ' namespace could not be found on xml \n'
	}

	const parentDocument =
		xmlDoc.get('//xmlns:meta[@name="parent-document"]', namespace)?.text() ||
		null

	if (!parentDocument) {
		errorMessage += ' parent-document meta element could not be found on xml \n'
	}

	const documentId =
		xmlDoc.get('//xmlns:meta[@name="document-id"]', namespace)?.text() ||
		xmlDoc.root()?.attr('document-version')?.value() ||
		null

	if (!documentId) {
		errorMessage += ' document-id element could not be found on xml \n'
	}

	if (!xmlTitle) {
		errorMessage +=
			' title attribute could not be found on xml or in request body \n'
	}

	if (!version) {
		errorMessage += ' version could not be found on xml or in request body \n'
	}

	if (errorMessage !== '') {
		throw helpers.errorHandler(400, errorMessage)
	}

	const xmlSchemaHash = helpers.getHash(namespace + '/' + version)
	const metaData = {
		document_id: documentId,
		year:
			xmlDoc.get('//xmlns:meta[@name="year"]', namespace)?.text() || 'unknown',
		book_abbrev:
			xmlDoc.get('//xmlns:meta[@name="book_abbrev"]', namespace)?.text() ||
			'unknown',
		parent: parentDocument,
	}

	return {
		namespace,
		xml: fileContent,
		xmlSchemaHash,
		xmlTitle,
		metaData,
	}
}

/**
 * Delete a document, based on Id
 *
 * documentId Integer Numeric Id of the document
 * returns response from Prisma
 **/
const xmlDocumentIdDELETE = async (documentId) => {
	const xmlDocFound = await findFirstWithAssetsXmlIndex(documentId)
	if (!xmlDocFound) {
		throw helpers.errorHandler(404, 'document not found')
	}

	const xmlDocAssets = xmlDocFound.xml_assets
	if (xmlDocAssets.length > 0) {
		await deleteAssets(
			process.env.BUCKET_NAME,
			xmlDocAssets.map((asset) => asset.file_location),
		)
	}

	return await deleteXmlIndex(documentId)
}

/**
 * Get a document, based on Id
 *
 * documentId Integer Numeric Id of the user to get
 * returns List
 **/
const xmlDocumentIdGET = async (documentId) =>
	await findFirstXmlIndex(documentId)
		.then(async (xml_index) => {
			if (xml_index) {
				return xml_index.is_valid
					? await findUniqueXmlContent(xml_index.id)
					: await findUniqueXmlForcedContent(xml_index.id)
			} else {
				throw helpers.errorHandler(
					404,
					`Could not find record for document with identifier ${documentId}`,
				)
			}
		})
		.catch((err) => {
			throw err
		})

/**
 * Put, Validate & Overwrite a document
 *
 * documentId Integer Numeric Id of the user to get
 * returns List
 **/
const xmlDocumentIdPUT = async (file, documentId) => {
	if (!file) throw helpers.errorHandler(400, 'Request must include xml file')
	const {xmlTitle} = xmlRequestCheck(file)

	return await updateXmlIndex(documentId, {title: xmlTitle}).then((xml_index) =>
		updateXmlContent(xml_index.id, file.buffer.toString()),
	)
}

const xmlDocumentIdTransform = async (documentId, queryParams) => {
	const transformContent = async (content, queryParams) => {
		const format = queryParams.format?.toUpperCase()
		if (!format) return content
		switch (format) {
			case 'PDF':
				return await xmlToPDFService(content, queryParams)
			case 'HTML':
				return await xmlToHtmlService(content, queryParams)
			case 'XML':
			default:
				return content
		}
	}

	return await findFirstXmlIndex(documentId)
		.then(async (xml_index) => {
			if (xml_index) {
				const record = xml_index.is_valid
					? await findUniqueXmlContent(xml_index.id)
					: await findUniqueXmlForcedContent(xml_index.id)
				return {
					fileName: xml_index.document_id,
					content: await transformContent(record.content, queryParams),
				}
			} else {
				throw helpers.errorHandler(
					404,
					`Could not find record for document with identifier ${documentId}`,
				)
			}
		})
		.catch((err) => {
			throw err
		})
}
/**
 * Returns all the documents the user has access to.
 *
 * returns List
 **/
const xmlGET = async (req) =>
	await findManyPaginationXml(req).catch((err) => {
		throw err
	})

/**
 * Push a new XML document
 *
 * returns List
 **/
const xmlPOST = async (file, params) => {
	if (!file) throw helpers.errorHandler(400, 'Request must include xml file')
	let skipValidation = params.skip === 'true'
	let ingest = params.ingest === 'true'

	const {xml, xmlTitle, xmlSchemaHash, metaData} = xmlRequestCheck(file, params)

	if (!Object.hasOwn(params, 'skip')) {
		skipValidation = false
		ingest = false
	}

	if (skipValidation) {
		return createWithContentForcedXmlIndex(
			{
				title: xmlTitle,
				status: 'draft',
				is_valid: false,
				lock_status: false,
				publishing_tool: 'Test',
				parent_doc: metaData.parent,
				document_id: metaData.document_id,
				year: metaData.year,
				book_abbrev: metaData.book_abbrev,
			},
			xml,
		)
	} else {
		return await findFirstWithContentXsdIndex(xmlSchemaHash).then(
			(xsd_index) => {
				if (!xsd_index) {
					return ingest
						? createWithContentForcedXmlIndex(
								{
									title: xmlTitle,
									status: 'draft',
									is_valid: false,
									lock_status: false,
									publishing_tool: 'Test',
									parent_doc: metaData.parent,
									document_id: metaData.document_id,
									year: metaData.year,
									book_abbrev: metaData.book_abbrev,
								},
								xml,
						  )
						: (() => {
								throw helpers.errorHandler(
									400,
									'No valid schema was found and ingest was set to false',
								)
						  })()
				} else {
					return validateXmlBoolean(xml, xsd_index.content.content)
						? createWithContentXmlIndex(
								{
									title: xmlTitle,
									status: 'draft',
									is_valid: true,
									lock_status: false,
									publishing_tool: 'Test',
									xsd_id: xsd_index.id,
									parent_doc: metaData.parent,
									document_id: metaData.document_id,
									year: metaData.year,
									book_abbrev: metaData.book_abbrev,
								},
								xml,
						  )
						: ingest
						? createWithContentForcedXmlIndex(
								{
									title: xmlTitle,
									status: 'draft',
									is_valid: false,
									lock_status: false,
									publishing_tool: 'Test',
									xsd_id: xsd_index.id,
									parent_doc: metaData.parent,
									document_id: metaData.document_id,
									year: metaData.year,
									book_abbrev: metaData.book_abbrev,
								},
								xml,
						  )
						: (() => {
								const {validationErrors} = validateXmlObject(
									xml,
									xsd_index.content.content,
								)
								throw helpers.errorHandler(400, validationErrors)
						  })()
				}
			},
		)
	}
}

const xmlValidatePOST = async (file, params) => {
	if (!file) throw helpers.errorHandler(400, 'Request must include xml file')

	const {xmlSchemaHash, xml} = xmlRequestCheck(file, params)

	return await findFirstWithContentXsdIndex(xmlSchemaHash).then((xsd_index) => {
		if (xsd_index) {
			const {errors, validationErrors} = validateXmlObject(
				xml,
				xsd_index.content.content,
			)
			if (errors.length < 1 && validationErrors.length < 1) {
				return `${file.originalname} validates`
			}

			throw helpers.errorHandler(200, {errors, validationErrors})
		} else {
			throw helpers.errorHandler(
				400,
				'No valid schema was found so no validation was done',
			)
		}
	})
}

const xmlLookUpSchemaGET = async (documentId) => {
	return await findFirstWithXsdXmlIndex(documentId)
		.then((xsd_doc) => {
			if (xsd_doc && xsd_doc.xsd) {
				return [
					{
						xsd_id: xsd_doc.xsd.id,
						namespace: xsd_doc.xsd.namespace,
					},
				]
			} else {
				throw helpers.errorHandler(
					404,
					`Could not find record for document with identifier ${documentId}`,
				)
			}
		})
		.catch((err) => {
			throw err
		})
}

module.exports = {
	createWithContentForcedXmlIndex,
	findUniqueXmlContent,
	xmlDocumentIdDELETE,
	xmlDocumentIdGET,
	xmlDocumentIdPUT,
	xmlDocumentIdTransform,
	xmlGET,
	xmlPOST,
	xmlValidatePOST,
	updateXmlContent,
	updateXmlIndex,
	findFirstWithContentXsdIndex,
	deleteXmlIndex,
	xmlLookUpSchemaGET,
}
