import { Injectable } from '@nestjs/common';
import { UUID } from 'crypto';
import { attendance, community_type, event_status } from 'src/common/constants/enums';
import { EventDAL } from 'src/event/dal/event.dal';
import { EventDateDal } from 'src/event/event_date/dal/event_date.dal';
import { ParticipantDAL } from 'src/event/participant/dal/participant.dal';
import { ParticipantSessionMapDal } from 'src/event/participant/dal/participant_session_map.dal';
import { Participant } from 'src/event/participant/entities/participant.entity';
import { Between, FindOptionsWhere } from 'typeorm';

@Injectable()
export class DashboardReportService {
    constructor(
        private readonly participantDAL: ParticipantDAL,
        private readonly ParticipantSessionMapDal: ParticipantSessionMapDal,
        private readonly eventDal: EventDAL,
        private readonly eventDateDal: EventDateDal
    ) { }

    private getDateRange(period?: 'week' | 'month' | 'year') {
        if (!period) return null;
        const now = new Date();
        let startDate: Date;
        switch (period) {
            case 'week':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 7);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                return null;
        }
        return { startDate, endDate: now };
    }

    //helper function for checking weather a participant participate 2/3 of atleast one event
    async isValidParticipant(participant: Participant): Promise<boolean> {
        try {

            const { data: sessionsMap } = await this.ParticipantSessionMapDal.findAll({
                where: {
                    participant: {
                        id: participant.id
                    }
                }, relations: ['participant', 'event_session', 'event_session.event_date', 'event_session.event_date.event']
            })

            const events = Array.from(
                new Map(
                    sessionsMap.flatMap(s => s.event_session.event_date.event)
                        .map(event => [event.id, event])
                ).values()
            );

            for (const event of events) {
                const numberOfDatesOfEvent = await this.eventDateDal.count({
                    where: {
                        event: {
                            id: event.id
                        }
                    }
                })
                const minDate = Math.ceil(0.667 * numberOfDatesOfEvent);
                const presenceDateOfParticipant = Math.ceil(
                    await this.ParticipantSessionMapDal.count({
                        where: {
                            participant: { id: participant.id },
                            event_session: { event_date: { event: { id: event.id } } },
                            attendance: { status: attendance.PRESENT }
                        }
                    }) / 2
                );

                if (presenceDateOfParticipant >= minDate && presenceDateOfParticipant !== 0) {
                    return true;
                }
            }
            return false
        } catch (error) {
            console.error(error);
        }
        return true
    }

    async loadParticipantStats(eventId?: UUID, period?: 'week' | 'month' | 'year') {
        let where: FindOptionsWhere<Participant> = {};
        if (eventId) {
            // filter by the related event's id
            where = { ...where, event: { id: eventId as any } } as any;
        }
        const dateRange = this.getDateRange(period);
        if (dateRange) {
            where.created_at = Between(dateRange.startDate, dateRange.endDate);
        }

        const totalParticipants = await this.participantDAL.count({ where });
        const totparticipants = (await this.participantDAL.findAll()).data
        const participantWhoParticipateMoreThanTwoThirds: Participant[] = []
        let maleValid = 0;
        let femaleValid = 0;

        for (const participant of totparticipants) {
            const isValid = await this.isValidParticipant(participant);
            if (isValid) {
                participantWhoParticipateMoreThanTwoThirds.push(participant);
                if (participant.gender === 'male') maleValid++;
                else if (participant.gender === 'female') femaleValid++;
            }
        }

        const ageGroups = [
            { label: 'under_18', min: 0, max: 17 },
            { label: '18_24', min: 18, max: 24 },
            { label: '25_34', min: 25, max: 34 },
            { label: '35_44', min: 35, max: 44 },
            { label: '45_54', min: 45, max: 54 },
            { label: '55_plus', min: 55, max: 120 },
        ];

        const ageGroupCounts: Record<string, number> = {};
        await Promise.all(
            ageGroups.map(async (g) => {
                const whereClause: FindOptionsWhere<Participant> = where
                    ? { ...where, age: Between(g.min, g.max) } as any
                    : ({ age: Between(g.min, g.max) } as any);

                const count = await this.participantDAL.count({
                    where: whereClause,
                });

                ageGroupCounts[g.label] = count;
            })
        );

        const communityTypes = Object.values(community_type);
        const communityStats: Record<string, number> = {}
        await Promise.all(
            communityTypes.map(async (type) => {
                const count = await this.participantDAL.count({
                    where: {
                        ...where,
                        community_type: type,
                    } as any,
                });

                communityStats[type] = count;
            })
        );

        const pwd = await this.participantDAL.count({
            where: {
                ...where,
                disability: "yes",
            } as any,
        });

        const nonPwd = await this.participantDAL.count({
            where: {
                ...where,
                disability: "no",
            } as any,
        });

        const male = await this.participantDAL.count({
            where: {
                ...where,
                gender: "male",
            } as any,
        });

        const female = await this.participantDAL.count({
            where: {
                ...where,
                gender: "female",
            } as any,
        });

        const occupationStats = {
            farmer: 0,
            agent: 0,
            other: 0,
        };

        const regionStats: Record<string, number> = {};

        const participants = await this.participantDAL.findAll(
            {
                where,
                select: ['occupation', 'region'],
                limit: 10000000,
            }
        );

        for (const p of participants.data) {
            const occ = (p.occupation || '').toLowerCase().trim();
            if (occ.includes('farm')) {
                occupationStats.farmer++;
            } else if (occ.includes('agent')) {
                occupationStats.agent++;
            } else {
                occupationStats.other++;
            }

            if (p.region) {
                regionStats[p.region] = (regionStats[p.region] || 0) + 1;
            }
        }

        return {
            success: true,
            "participant stats": {
                totalParticipants,
                ageGroups: ageGroupCounts,
                // communityTypes: communityStats,
                // pwd,
                // nonPwd,
                male,
                female,
                // occupationStats,
                regionStats,
                "participantsWithAtLeastTwoThirdsEventParticipation": participantWhoParticipateMoreThanTwoThirds.length,
                maleParticipantsWithAtLeastTwoThirds: maleValid,
                femaleParticipantsWithAtLeastTwoThirds: femaleValid
            }
        };
    }

    async eventStats(period?: 'week' | 'month' | 'year') {
        let where: FindOptionsWhere<any> = {};
        const dateRange = this.getDateRange(period);
        if (dateRange) {
            where.created_at = Between(dateRange.startDate, dateRange.endDate);
        }

        const totalEvents = await this.eventDal.count({ where });
        const initatedEvents = await this.eventDal.count({
            where: {
                ...where,
                event_status: event_status.INITATED
            }
        });
        const ongoingEvents = await this.eventDal.count({
            where: {
                ...where,
                event_status: event_status.ONGOING
            }
        });
        const completedEvents = await this.eventDal.count({
            where: {
                ...where,
                event_status: event_status.COMPLATED
            }
        });

        return {
            success: true,
            "events stats": {
                totalEvents,
                initatedEvents,
                ongoingEvents,
                completedEvents
            }
        };
    }
}
