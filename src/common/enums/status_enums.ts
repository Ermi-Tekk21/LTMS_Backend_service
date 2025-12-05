export enum event_status {
    INITATED = "initiated",
    IN_PREPARATION = "in_preparation",
    ONGOING = "on-going",
    ACTIVE = "active",
    COMPLATED = "completed"
}

export enum activity_status_type {
    BUDGET_STATUS = "budget_status",
    PROMOTIONAL_MATERIAL_STATUS = "promotional_material_status",
    LOGISTICS = "logistics"
}

export enum progres_status {
    PENDING = "pending",
    ACCEPTED = "accepted",
    APPROVED = "approved",
    REJECTED = "rejected",
    DONE = "done"
}

export enum doc_type {
    TOR = "tor",
    TRAINING_MATERIAL = "training_material",
    FEEDBACK = "feedback",
    ATTENDANCE = "attendance",
    MEDIA = "media",
    PORTFOLIO = "portfolio",
    REPORT = "report",
}

export enum community_type {
    IDPs = 'idps',
    Refugees = 'refugees',
    HostResident = 'hostresident',
    Returning = 'returning',
}

export enum attendance {
    PRESENT = 'Present',
    ABSENT = 'Absent'
}
export enum gender {
    MALE = 'male',
    FEMALE = 'female'
}

export enum reportType {
    EMPTY_ATT = '',
    ATT_REP = 'Report'
}