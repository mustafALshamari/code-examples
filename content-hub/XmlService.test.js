const {
	validateXmlBoolean,
	validateXmlObject,
} = require('../../../service/validation/SchemaValidationService')
const {
	xmlPOST,
	xmlGET,
	xmlDocumentIdGET,
	xmlDocumentIdDELETE,
	updateXmlContent,
	updateXmlIndex,
	findFirstWithContentXsdIndex,
	xmlValidatePOST,
	xmlLookUpSchemaGET,
} = require('../../../service/XMLService')
const {prismaMock} = require('../../../utils/mockClient')
const {mockClient} = require('aws-sdk-client-mock')
require('aws-sdk-client-mock-jest')
const {S3Client, DeleteObjectsCommand} = require('@aws-sdk/client-s3')
const fs = require('fs')
const testXml = fs.readFileSync(
	'src/tests/mockFiles/IBC2021P2_TESTING.xml',
	'utf-8',
)

jest.mock('../../../service/validation/SchemaValidationService', () => ({
	validateXmlBoolean: jest.fn(),
	validateXmlObject: jest.fn(),
}))

describe('xmlService', () => {
	let req, s3Mock

	beforeAll(() => {
		s3Mock = mockClient(S3Client)
		s3Mock.on(DeleteObjectsCommand).resolves({})
	})

	beforeEach(() => {
		req = {
			body: {
				skip: 'true',
				ingest: 'false',
				versionId: '1',
				xmlTitle: 'test',
			},
			files: [
				{
					mimetype: 'application/xml',
					size: '3000',
					buffer: testXml,
				},
			],
		}
	})

	describe('xmlPOST', () => {
		test('should throw error when passing in invalid XML', async () => {
			req.files[0].buffer = '32432'
			expect.assertions(2)
			try {
				await xmlPOST(req.files[0], req.body)
			} catch (err) {
				expect(err.statusCode).toEqual(400)
				expect(err.message.message).toMatch('Start tag expected, \'<\' not found')
			}
		})

		test('should create record in xml_index table when skip is false and ingest is true', async () => {
			req.body.skip = 'false'
			req.body.ingest = 'true'
			prismaMock.xml_index.create.mockResolvedValue(true)
			prismaMock.xsd_index.findFirst.mockResolvedValue(null)
			const data = await xmlPOST(req.files[0], req.body)
			expect(data).toEqual(true)
		})

		test('should throw error when skip is false, ingest is false, and no schema was found to validate against', async () => {
			req.body.skip = 'false'
			prismaMock.xsd_index.findFirst.mockResolvedValue(null)
			expect.assertions(2)
			try {
				await xmlPOST(req.files[0], req.body)
			} catch (err) {
				expect(err.statusCode).toEqual(400)
				expect(err.message).toMatch(
					'No valid schema was found and ingest was set to false',
				)
			}
		})

		test('should create record in xml_content when xml is validated', async () => {
			req.body.skip = 'false'
			prismaMock.xsd_index.findFirst.mockResolvedValue({
				content: {
					content: true,
				},
			})
			validateXmlBoolean.mockReturnValueOnce(true)

			prismaMock.xml_index.create.mockResolvedValue(true)

			const data = await xmlPOST(req.files[0], req.body)
			expect(data).toEqual(true)
		})

		test('should create record in xml_content_forced when xml is invalid, but ingest is true', async () => {
			req.body.skip = 'false'
			req.body.ingest = 'true'
			prismaMock.xsd_index.findFirst.mockResolvedValue({
				content: {
					content: true,
				},
			})
			validateXmlBoolean.mockReturnValueOnce(false)
			prismaMock.xml_index.create.mockResolvedValue(true)

			const data = await xmlPOST(req.files[0], req.body)
			expect(data).toEqual(true)
		})

		test('should throw error when xml fails validation and ingest is false', async () => {
			req.body.skip = 'false'

			prismaMock.xsd_index.findFirst.mockResolvedValue({
				content: {
					content: true,
				},
			})
			const validationErrors = ['err']

			validateXmlBoolean.mockReturnValueOnce(false)
			validateXmlObject.mockReturnValueOnce({
				errors: [],
				validationErrors: validationErrors,
			})

			expect.assertions(2)
			try {
				await xmlPOST(req.files[0], req.body)
			} catch (err) {
				expect(err.statusCode).toEqual(400)
				expect(err.message[0]).toMatch(validationErrors[0])
			}
		})
	})

	describe('xmlGET', () => {
		let req

		beforeEach(() => {
			req = {
				query: {
					Title: '',
					shortCode: '',
					Status: '',
					Locked: '',
					printYear: '',
					Valid: '',
					pageNumber: '',
					pageSize: '',
				},
			}
		})

		test('should get XML details with pagination(per page 10 records) and with filter As Status = draft', async () => {
			const mockData = [
				{
					title: '2021 International Building Code 1',
					year: '2021',
					version: '1.0',
					status: 'draft',
					lock_status: false,
					is_valid: false,
				},
				{
					title: '2021 International Building Code 2',
					year: '2021',
					version: 'IBC_2021_1.0',
					status: 'draft',
					lock_status: false,
					is_valid: true,
				},
			]
			req.query.status = 'draft'
			req.query.pageNumber = 1
			req.query.pageSize = 2
			prismaMock.xml_index.findMany.mockResolvedValue(mockData)
			const data = await xmlGET(req)
			expect(data).toEqual(mockData)
		})

		test('should get XML details without pagination(Default 10 records,Default page 1) and without filter', async () => {
			const mockData = [
				{
					title: '2021 International Building Code 1',
					year: '2021',
					version: '1.0',
					status: 'published',
					lock_status: false,
					is_valid: false,
				},
				{
					title: '2021 International Building Code 2',
					year: '2021',
					version: 'IBC_2021_1.0',
					status: 'published',
					lock_status: false,
					is_valid: true,
				},
			]
			req.query.pageNumber = ''
			req.query.pageSize = ''
			prismaMock.xml_index.findMany.mockResolvedValue(mockData)
			const data = await xmlGET(req)
			expect(data).toEqual(mockData)
		})
		test('should get XML details with pagination(Default 10 records,Default page 1) and with filter lock_status is true', async () => {
			const mockData = [
				{
					title: '2021 International Building Code 1',
					year: '2021',
					version: '1.0',
					status: 'published',
					lock_status: true,
					is_valid: false,
				},
				{
					title: '2021 International Building Code 3',
					year: '2021',
					version: 'IBC_2021_1.0',
					status: 'draft',
					lock_status: true,
					is_valid: true,
				},
				{
					title: '2021 International Building Code 4',
					year: '2021',
					version: 'IBC_2021_1.0',
					status: 'draft',
					lock_status: true,
					is_valid: true,
				},
			]
			req.query.lock_status = true
			req.query.pageNumber = 1
			req.query.pageSize = 10
			prismaMock.xml_index.findMany.mockResolvedValue(mockData)
			const data = await xmlGET(req)
			expect(data).toEqual(mockData)
		})
	})

	describe('xmlLookUpSchemaGET', () => {
		test('should retrieve document id and namespace from xsd table when doc is valid', async () => {
			const mockDocumentId = 1
			const mockXsd = {
				id: 1,
				namespace: 'https://schema.iccsafe.org/book/schema/1.0',
			}
			prismaMock.xml_index.findUnique.mockResolvedValueOnce({
				id: mockDocumentId,
				xsd: mockXsd,
			})
			const expectedResponse = [
				{
					xsd_id: mockXsd.id,
					namespace: mockXsd.namespace,
				},
			]
			const response = await xmlLookUpSchemaGET(mockDocumentId)
			expect(response).toEqual(expectedResponse)
		})

		test('should retrieve 404 if documentId is invalid', async () => {
			prismaMock.xml_index.findUnique.mockResolvedValueOnce(null)
			const invalidDocumentId = 2

			try {
				await xmlLookUpSchemaGET(invalidDocumentId)
			} catch (err) {
				expect(err.statusCode).toEqual(404)
				expect(err.message).toMatch(
					'Could not find record for document with identifier 2',
				)
			}
		})
	})

	describe('xmlDocumentIdGET', () => {
		test('should retrieve document from xml_content table when doc is valid', async () => {
			prismaMock.xml_index.findFirst.mockResolvedValueOnce({
				id: 1,
				is_valid: true,
			})

			prismaMock.xml_content.findUnique.mockResolvedValueOnce(true)

			expect(await xmlDocumentIdGET(1)).toBe(true)
		})

		test('should retrieve document from xml_content_forced table when doc is invalid', async () => {
			prismaMock.xml_index.findFirst.mockResolvedValueOnce({
				id: 1,
				is_valid: false,
			})

			prismaMock.xml_content_forced.findUnique.mockResolvedValueOnce(true)

			expect(await xmlDocumentIdGET(1)).toBe(true)
		})
	})

	describe('xmlDocumentIdDELETE', () => {
		test('should delete xml content record', async () => {
			const mockValue = {
				id: 1,
				xsd_id: 1,
				title: '2021 International Building Code',
				status: 'draft',
				update_type: 'Scheduled',
				is_valid: true,
				lock_status: false,
				publishing_tool: 'Test',
				parent_doc: 'IBC2021',
				document_id: 'IBC_2021_1.0',
				year: '2021',
				book_abbrev: 'IBC',
				created_at: '2022-12-01T16:00:25.543Z',
				updated_at: '2022-12-01T16:00:25.543Z',
				xml_assets: [
					{
						id: 342234,
						xml_id: 1,
						file_location: '1/test.png',
						file_name: 'test.png',
					},
				],
			}
			prismaMock.xml_index.findFirst.mockResolvedValue(mockValue)
			prismaMock.xml_index.delete.mockResolvedValue(mockValue)
			const data = await xmlDocumentIdDELETE(1)
			expect(data).toEqual(mockValue)
		})

		test('should return 404 when no record matches document id', async () => {
			const mockValue = {id: 1}
			expect.assertions(2)
			prismaMock.xml_index.findFirst.mockResolvedValue(null)
			prismaMock.xml_index.update.mockResolvedValue(null)
			try {
				expect(await xmlDocumentIdDELETE(1)).toEqual(mockValue)
			} catch (err) {
				expect(err.statusCode).toEqual(404)
				expect(err.message).toMatch('document not found')
			}
		})
	})

	describe('xmlDocumentIdPUT', () => {
		test('should update the xml content record', async () => {
			const mockValue = [
				{
					id: 4,
					xml_content: testXml,
				},
			]
			prismaMock.xml_content.update.mockResolvedValue(mockValue)
			expect(await updateXmlContent(4, testXml)).toEqual(mockValue)
		})

		test('should update the xml index record', async () => {
			const mockValue = [
				{
					id: 4,
					xmlTitle: 'xmlTitle',
				},
			]
			prismaMock.xml_index.update.mockResolvedValue(mockValue)
			expect(await updateXmlIndex(4, 'xmlTitle')).toEqual(mockValue)
		})
	})

	describe('xmlValidatePOST', () => {
		test('XML validation against schema', async () => {
			const mockValue = {
				id: 1,
				namespace: 'https://schema.iccsafe.org/book/schema/1.0',
				version: '1.0',
				ns_hash_val: '-1090472396',
				created_at: '2022-12-01T15:16:59.130Z',
				updated_at: '2022-12-01T15:16:59.130Z',
				content: {
					id: 1,
					content: testXml,
					xsd_id: 1,
				},
			}
			prismaMock.xsd_index.findFirst.mockResolvedValue(mockValue)
			expect(await findFirstWithContentXsdIndex('-1090472396')).toEqual(
				mockValue,
			)
		})
		test('show throw error when file size is 0', async () => {
			req.body.versionId = '1.0'
			req.files[0].mimetype = 'application/xml'
			req.files[0].size = 0
			req.files[0].buffer = ''
			expect.assertions(2)
			try {
				await xmlValidatePOST(req.files[0], req.body)
			} catch (err) {
				expect(err.statusCode).toEqual(400)
				expect(err.message.message).toMatch(
					'File size must exist and be greather then 0',
				)
			}
		})

		test('should throw error when no file was attached to request', async () => {
			req.body.versionId = '1.0'

			expect.assertions(2)
			try {
				await xmlValidatePOST(undefined, req.body)
			} catch (err) {
				expect(err.statusCode).toEqual(400)
				expect(err.message).toMatch('Request must include xml file')
			}
		})
	})
})
