// import axios, { AxiosResponse } from 'axios';
// import { Injectable } from '@nestjs/common';
// import { ParticipantService } from './participant.service';

// @Injectable()
// export class ExternalParticipantService {
//   private readonly FARMER_URL =
//     'http://13.50.253.205:3344/api/v1/farmer/find_all';

//   private readonly AGENT_URL =
//     'http://13.50.253.205:3344/api/v1/dynamic-form/project/all_agents';

//   constructor(
//     private readonly participantService: ParticipantService,
//   ) {}

//   async searchAvailableParticipants(
//     token: string,
//     eventId: string,
//     filters: {
//       search?: string;
//       participantType?: 'farmer' | 'agent';
//       region?: string;
//       zone?: string;
//       woreda?: string;
//     },
//   ) {
//     // 1️⃣ Already added participants (external IDs)
//     const existingIds =
//       await this.participantService.findParticipantIdsByEvent(eventId);

//     const headers = {
//       Authorization: `Bearer ${token}`,
//       'Content-Type': 'application/json', // Important for POST
//     };

//     const requests: Promise<AxiosResponse<any>>[] = [];

//     // 2️⃣ Fetch farmers (POST instead of GET)
//    if (!filters.participantType || filters.participantType === 'farmer') {
//   requests.push(
//     axios.post(
//       this.FARMER_URL,
//       {
//         search: filters.search,
//         region: filters.region,
//         zone: filters.zone,
//         woreda: filters.woreda,
//       },
//       { headers }
//     )
//   );
// }


//     // 3️⃣ Fetch agents (GET is fine)
//     if (!filters.participantType || filters.participantType === 'agent') {
//       requests.push(
//         axios.get(this.AGENT_URL, {
//           headers,
//           params: {
//             search: filters.search,
//           },
//         }),
//       );
//     }

//    // ...existing code...
//     const responses = await Promise.all(requests);

//     // 4️⃣ Normalize + merge (defensive: some endpoints return data.data array, others return data or data.items)
//     const normalizeResponse = (res: AxiosResponse<any>) => {
//       const payload = res?.data;
//       if (!payload) return [];
//       if (Array.isArray(payload.data)) return payload.data;
//       if (Array.isArray(payload)) return payload;
//       if (Array.isArray(payload.items)) return payload.items;
//       if (Array.isArray(payload.data?.items)) return payload.data.items;
//       return [];
//     };

//     const mergedRaw = responses.flatMap((res) => normalizeResponse(res));

//     // 5️⃣ Exclude already-added participants
//     const existingIdsSet = new Set(existingIds || []);
//     const merged = mergedRaw
//       .filter((item: any) => item && item.id && !existingIdsSet.has(item.id))
//       .map((item: any) => ({
//         id: item.id,
//         fullName: item.fullName || item.name,
//         phone: item.phone,
//         region: item.region,
//         zone: item.zone,
//         woreda: item.woreda,
//         participant_type: item.agentCode ? 'agent' : 'farmer',
//         raw: item,
//       }));

//     return merged;
//   }
// }
