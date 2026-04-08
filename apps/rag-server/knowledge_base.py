from dataclasses import dataclass, field


@dataclass(frozen=True)
class Section:
    id: str
    title: str
    keywords: list[str] = field(default_factory=list)
    content: str = ""


SECTIONS: list[Section] = [
    Section(
        id="overview",
        title="1. General Product Overview",
        keywords=[
            "skedulelt", "what is", "about", "overview",
            "platform", "ios", "android", "trinidad",
        ],
        content=(
            "Skedulelt is a mobile scheduling and payment solution specifically designed\n"
            "for service providers and customers in Trinidad & Tobago (T&T).\n"
            "\n"
            "Target Users : Barbers, hairdressers, aestheticians, and their clients.\n"
            "Platforms    : iOS and Android."
        ),
    ),
    Section(
        id="customer_faq",
        title="2. Customer FAQ",
        keywords=[
            "book", "booking", "schedule", "appointment", "make appointment",
            "talk", "chat", "message", "contact", "send photo", "messaging",
            "pay", "payment", "cost", "credit card", "transaction", "price",
            "how do i", "barber", "stylist", "portfolio",
        ],
        content=(
            '--- How do I book an appointment? ---\n'
            'Open the Skedulelt Customer App, use the "Search & Discovery" feature to find\n'
            "a provider (like a barber or stylist), view their portfolio, and select an\n"
            "available time slot.\n"
            "\n"
            "--- Can I talk to my service provider before the appointment? ---\n"
            'Yes. The app includes an "In-App Messaging" service. You can send text\n'
            "messages and photos directly to your provider once a booking has been assigned.\n"
            "\n"
            "--- How does payment work? ---\n"
            'Payments are handled securely through the app\'s integrated "Payment Processing\n'
            'Service." It supports local transaction standards in Trinidad & Tobago.'
        ),
    ),
    Section(
        id="provider_faq",
        title="3. Service Provider FAQ",
        keywords=[
            "manage", "schedule", "availability", "calendar", "working hours", "block time",
            "grow", "business", "marketing", "more customers", "fill slots", "recommendations",
            "performance", "earnings", "report", "analytics", "money", "financials",
            "service provider", "how do i get paid",
        ],
        content=(
            "--- How do I manage my schedule? ---\n"
            "Use the Service Provider App to set your working hours and manage your profile.\n"
            'The "Appointment Scheduling Service" handles bookings, rescheduling, and\n'
            "cancellations automatically.\n"
            "\n"
            "--- How can I grow my business on Skedulelt? ---\n"
            'The app features a "Personalised Activity and Service Recommendation" engine.\n'
            'It sends "Contextual Prompts" to users near you if you have a last-minute\n'
            "cancellation slot open, helping you fill your day.\n"
            "\n"
            "--- Can I see my business performance? ---\n"
            'Yes. The "Financials & Reporting" module provides detailed analytics on your\n'
            "transactions, popular services, and earnings."
        ),
    ),
    Section(
        id="policies",
        title="4. Official Policies",
        keywords=[
            "cancel", "cancellation", "reschedule", "no-show", "no show",
            "policy", "policies", "ttd", "currency", "refund", "dispute",
            "safe", "secure", "security", "encrypted", "privacy", "data",
            "credit card safe", "authentication", "login",
        ],
        content=(
            "=== Appointment & Cancellation Policy ===\n"
            "1. Modifications   : Customers can reschedule or cancel appointments via the\n"
            "                     mobile app.\n"
            "2. Provider Rights : Service providers have the right to update their\n"
            "                     availability at any time to prevent double-bookings.\n"
            '3. No-Show Tracking: Reliability is monitored through the "Review & Rating\n'
            '                     Service." Frequent no-shows may impact a user\'s ability\n'
            "                     to book future services.\n"
            "\n"
            "=== Payment & Refund Policy ===\n"
            "1. Currency : All transactions are processed in Trinidad & Tobago Dollars (TTD).\n"
            "2. Security : All payment data is encrypted and managed by a secure\n"
            "              cloud-based backend (Firebase / Google Cloud).\n"
            "3. Disputes : Transaction disputes are handled through the\n"
            '              "Admin / Customer Support Portal."\n'
            "\n"
            "=== Data Privacy & Security ===\n"
            "1. Authentication : User identities are managed by a dedicated Authentication\n"
            "                    Service using secure access tokens.\n"
            "2. Messaging      : In-app chat is private and end-to-end encrypted between\n"
            "                    the client and the provider.\n"
            '3. Data Usage     : Profile data is used to provide "Next Best Action" prompts\n'
            '                    (e.g., reminding a user it has been 16 years since their\n'
            "                    last haircut)."
        ),
    ),
]


def get_full_knowledge_base() -> str:
    return "\n\n---\n\n".join(f"### {section.title}\n{section.content}" for section in SECTIONS)


@dataclass
class RelevantContext:
    matched: list[str]
    full_text: str


def get_relevant_context(query: str) -> RelevantContext:
    lower = query.lower()

    matched = sorted(
        (
            section
            for section in SECTIONS
            if any(keyword in lower for keyword in section.keywords)
        ),
        key=lambda section: sum(1 for keyword in section.keywords if keyword in lower),
        reverse=True,
    )

    selected = matched if matched else SECTIONS

    return RelevantContext(
        matched=[section.title for section in selected],
        full_text="\n\n---\n\n".join(
            f"### {section.title}\n{section.content}" for section in selected
        ),
    )
