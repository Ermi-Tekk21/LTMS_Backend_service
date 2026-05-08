import { Injectable } from '@nestjs/common';
import { UUID } from 'crypto';
import { attendance, community_type, event_status } from 'src/common/constants/enums';
import { EventDAL } from 'src/event/dal/event.dal';
import { EventDateDal } from 'src/event/event_date/dal/event_date.dal';
import { ParticipantDAL } from 'src/event/participant/dal/participant.dal';
import { ParticipantSessionMapDal } from 'src/event/participant/dal/participant_session_map.dal';
import { Participant } from 'src/event/participant/entities/participant.entity';
import { Between, FindOptionsWhere, MoreThanOrEqual } from 'typeorm';
import { LocationService } from 'src/location/location.service';

@Injectable()
export class DashboardReportService {
    constructor(
        private readonly participantDAL: ParticipantDAL,
        private readonly ParticipantSessionMapDal: ParticipantSessionMapDal,
        private readonly eventDal: EventDAL,
        private readonly eventDateDal: EventDateDal,
        private readonly locationService: LocationService
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
            const relations = [
                'participant',
                'event_session.event_date.event',
            ];

            const { data: sessionsMap } = await this.ParticipantSessionMapDal.findAll({
                where: {
                    participant: { id: participant.id },
                },
                relations,
            });

            const events = Array.from(
                new Map(
                    sessionsMap
                        .flatMap((s: any) => s.event_session?.event_date?.event || [])
                        .map((event: any) => [event.id, event])
                ).values()
            );

            for (const event of events) {
                const numberOfDatesOfEvent = await this.eventDateDal.count({
                    where: { event: { id: event.id } },
                });

                const minDate = Math.ceil(0.667 * numberOfDatesOfEvent);

                const presenceDateOfParticipant = Math.ceil(
                    (await this.ParticipantSessionMapDal.count({
                        where: {
                            participant: { id: participant.id },
                            event_session: { event_date: { event: { id: event.id } } },
                            attendance: { status: attendance.PRESENT },
                        },
                    })) / 2
                );

                if (presenceDateOfParticipant >= minDate && presenceDateOfParticipant !== 0) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('isValidParticipant error:', error);
            return false;
        }
    } async loadParticipantStats(eventId?: UUID, period?: 'week' | 'month' | 'year', token?: string) {
        let where: FindOptionsWhere<Participant> = {};
        if (eventId) {
            where = { ...where, event: { id: eventId as any } } as any;
        }

        const dateRange = this.getDateRange(period);
        if (dateRange) {
            where.created_at = Between(dateRange.startDate, dateRange.endDate);
        }

        // 1. Get all participants at once
        const allParticipants = await this.participantDAL.findAll({ where, limit: 1000000 });
        let participants = allParticipants.data;
        const totalParticipants = participants.length;

        // 2. Participants with at least 2/3 event participation
        const participantWhoParticipateMoreThanTwoThirds: Participant[] = [];
        let maleValid = 0;
        let femaleValid = 0;

        for (const participant of participants) {
            const isValid = await this.isValidParticipant(participant);
            if (isValid) {
                participantWhoParticipateMoreThanTwoThirds.push(participant);
                if (participant.gender === 'male') maleValid++;
                else if (participant.gender === 'female') femaleValid++;
            }
        }

        // 3. Age groups percentages (skip null or empty ages)
        const ageGroups = [
            { label: 'under_18', min: 0, max: 17 },
            { label: '18_24', min: 18, max: 24 },
            { label: '25_34', min: 25, max: 34 },
            { label: '35_44', min: 35, max: 44 },
            { label: '45_54', min: 45, max: 54 },
            { label: '55_plus', min: 55, max: 90 }
        ];

        const validParticipantsForAge = participants.filter(p => p.age !== null && p.age !== "" && !isNaN(Number(p.age)));
        const totalValidAgeParticipants = validParticipantsForAge.length;

        const ageGroupCounts: Record<string, number> = {};
        ageGroups.forEach(g => {
            ageGroupCounts[g.label] = validParticipantsForAge.filter(p => {
                const ageNum = Number(p.age);
                return ageNum >= g.min && ageNum <= g.max;
            }).length;
        });


        const ageGroupPercentages: Record<string, number> = {};
        for (const key in ageGroupCounts) {
            ageGroupPercentages[key] = totalValidAgeParticipants > 0
                ? Math.round(ageGroupCounts[key] / totalValidAgeParticipants * 100)
                : 0;
        }

        // 4. Gender counts
        const maleCount = participants.filter(p => p.gender === 'male').length;
        const femaleCount = participants.filter(p => p.gender === 'female').length;

        // 5. Community type counts
        // const communityTypes = Object.values(community_type);
        // const communityStats: Record<string, number> = {};
        // communityTypes.forEach(type => {
        //     communityStats[type] = participants.filter(p => p.community_type === type).length;
        // });

        // 6. PWD counts
        // const pwdCount = participants.filter(p => p.disability === 'yes').length;
        // const nonPwdCount = participants.filter(p => p.disability === 'no').length;

        // 7. Occupation counts
        // const occupationStats = { farmer: 0, agent: 0, other: 0 };
        // participants.forEach(p => {
        //     const occ = (p.occupation || '').toLowerCase().trim();
        //     if (occ.includes('farm')) occupationStats.farmer++;
        //     else if (occ.includes('agent')) occupationStats.agent++;
        //     else occupationStats.other++;
        // });

        // 8. Region counts
        const regionStats: Record<string, number> = {};

        if (token && participants.length > 0) {
            try {
                const woredasWithParents = await this.locationService.fetchWoredasWithParents(token);
                const lookup = new Map(woredasWithParents.map(w => [String(w.woreda_id), w]));

                // Enrich participants with hierarchical names
                const enrichedParticipants = participants.map(p => {
                  const woredaId = (p as any).Newlocation_id;
                  const result: any = { ...p };
                  if (woredaId && lookup.has(String(woredaId))) {
                    const loc = lookup.get(String(woredaId));
                    result.region = loc.region_name;
                    result.zone = loc.zone_name;
                    result.woreda = loc.woreda_name;
                    const regionName = loc.region_name;
                    regionStats[regionName] = (regionStats[regionName] || 0) + 1;
                  }
                  return result;
                });
                // replace participants with enriched version for later use
                participants = enrichedParticipants as any;
            } catch (error) {
                console.error('Failed to fetch region names for dashboard stats:', error.message);
            }
        }

        return {
            success: true,
            "participant stats": {
                totalParticipants,
                ageGroups: ageGroupPercentages,
                gender: { male: maleCount, female: femaleCount },
                // communityTypes: communityStats,
                // pwd: pwdCount,
                // nonPwd: nonPwdCount,
                // occupation: occupationStats,
                region: regionStats,
                participants: participants, // enriched participants with region, zone, woreda
                participantsWithAtLeastTwoThirdsEventParticipation: participantWhoParticipateMoreThanTwoThirds.length,
                maleParticipantsWithAtLeastTwoThirds: maleValid,
                femaleParticipantsWithAtLeastTwoThirds: femaleValid,
            }
        };    }

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
