
import { Test, TestingModule } from '@nestjs/testing';
import { EventService } from './event.service';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import axios from 'axios';
import { participant_type } from 'src/common/constants/enums';

// Mock dependencies
const mockDataSource = {
    getRepository: jest.fn(),
    createQueryRunner: jest.fn(),
};

const mockParticipantRepo = {
    createQueryBuilder: jest.fn(),
};

const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
};

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('EventService - searchParticipantsForEvent', () => {
    let service: EventService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EventService,
                { provide: DataSource, useValue: mockDataSource },
                // Mock other dependencies of EventService as null or simple mocks since we only test one method
                { provide: 'EventRepository', useValue: {} }, // Mocking injected repository if any
                { provide: 'SessionParticipantMapRepository', useValue: {} },
                { provide: 'LocationService', useValue: {} },
                { provide: 'EventSessionService', useValue: {} },
                { provide: 'AwsS3Service', useValue: {} },
                { provide: 'EmailService', useValue: {} },
            ],
        }).compile();

        service = module.get<EventService>(EventService);

        // Manually mock the method we are NOT testing but is called
        service.getEventParticipants = jest.fn().mockResolvedValue({ data: [] });

        // Setup Repo Mock
        mockDataSource.getRepository.mockReturnValue(mockParticipantRepo);
        mockParticipantRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should apply filters to local query builder', async () => {
        mockQueryBuilder.getMany.mockResolvedValue([]);

        await service.searchParticipantsForEvent(
            'event-123',
            'John',
            1,
            10,
            'token',
            {
                participant_type: participant_type.FARMER,
                region: 'Oromia',
                zone: 'Jimma',
                kebele: 'Mana'
            }
        );

        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('p.participant_type = :pType', { pType: 'farmer' });
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('p.region ILIKE :region', { region: '%Oromia%' });
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('p.zone ILIKE :zone', { zone: '%Jimma%' });
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('p.kebele ILIKE :kebele', { kebele: '%Mana%' });
    });

    it('should optimize external calls: only fetch Farmers if participant_type is FARMER', async () => {
        mockQueryBuilder.getMany.mockResolvedValue([]);
        mockedAxios.post.mockResolvedValue({ data: { data: { data: [] } } });

        await service.searchParticipantsForEvent(
            'event-123',
            'John',
            1,
            10,
            'token',
            { participant_type: participant_type.FARMER }
        );

        // Should call farmers API
        expect(mockedAxios.post).toHaveBeenCalled();
        // Should NOT call agents API
        expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should optimize external calls: only fetch Agents if participant_type is LERSHA_AGENT', async () => {
        mockQueryBuilder.getMany.mockResolvedValue([]);
        mockedAxios.get.mockResolvedValue({ data: { data: [] } });

        await service.searchParticipantsForEvent(
            'event-123',
            'John',
            1,
            10,
            'token',
            { participant_type: participant_type.LERSHA_AGENT }
        );

        // Should call agents API
        expect(mockedAxios.get).toHaveBeenCalled();
        // Should NOT call farmers API
        expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should filter external results based on location', async () => {
        mockQueryBuilder.getMany.mockResolvedValue([]);

        // Mock Agent response with mismatched location
        mockedAxios.get.mockResolvedValue({
            data: {
                data: [{
                    id: 1,
                    first_name: 'John',
                    location: { region: 'Amhara' }, // Mismatch
                    phone_number: '0911223344'
                }]
            }
        });

        const result = await service.searchParticipantsForEvent(
            'event-123',
            'John',
            1,
            10,
            'token',
            {
                participant_type: participant_type.LERSHA_AGENT,
                region: 'Oromia' // Filter
            }
        );

        // Should be filtered out
        expect(result.data).toHaveLength(0);
    });
});
