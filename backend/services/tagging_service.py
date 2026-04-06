from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional


def _days_since(dt) -> int:
    if not dt:
        return 99999
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt)
        except Exception:
            return 99999
    # incase i forget, utc for firestore + datemath 
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return max(0, (now - dt).days)


def get_provider_tagging_config(db, provider_id: str) -> Dict:
    """Load provider's custom tagging thresholds, or return defaults."""
    try:
        config_doc = db.collection("provider_tagging_rules").document(provider_id).get()
        if config_doc.exists:
            return config_doc.to_dict()
    except Exception:
        pass
    
    #----------------------------------------------------------
    # DEFAULT THRESHOLDS 
    #----------------------------------------------------------
    return {
        "frequency_thresholds": {"returning": 2, "regular": 5, "loyal": 10},
        "spending_thresholds": {"regular_spender": 100, "high_value": 500, "premium": 1000},
        "recency_thresholds": {"active_days": 30, "at_risk_days": 180},
        "tag_colors": {
            "First Visit": "#34C759",
            "Returning": "#42BBEB",
            "Regular": "#FF9500",
            "Loyal": "#AF52DE",
            "Active": "#42BBEB",
            "At Risk": "#FF9500",
            "Inactive": "#FF3B30",
            "New Client": "#8E8E93",
            "Regular Spender": "#42BBEB",
            "High Value": "#FF9500",
            "Premium": "#AF52DE",
            "Last Minute": "#FF3B30",
            "Planner": "#34C759",
            "Consistent": "#42BBEB",
            "Spot Booker": "#8E8E93",
            "Morning Person": "#FFCC00",
            "Afternoon": "#FF9500",
            "Evening": "#AF52DE",
            "Weekend Preferred": "#42BBEB",
            "Weekday": "#34C759",
            "Reliable": "#34C759",
            "Sometimes Late": "#FF9500",
            "Frequent Canceller": "#FF3B30",
            "Service Explorer": "#42BBEB",
            "Loyal to One": "#34C759",
            "Premium Add-ons": "#FF9500",
            "Quick Responder": "#34C759",
            "Inquiring": "#42BBEB",
            "Direct Booker": "#8E8E93"
        },
        "tag_priority": "auto_first",  # "auto_first", "manual_first", or "merge"
        "category_weights": {
            "frequency": 50,  # (First Visit, Returning, Regular, Loyal)
            "recency": 50,    # (Active, At Risk, Inactive)
            "spending": 50,   # (New Client, Regular Spender, High Value, Premium)
        },
        "enable_phases": {
            "phase1": True,
            "phase2": True,
            "phase3": True,
            "phase4": True
        },
        "enabled": True
    }


def _get_tag_color(tag_name: str, config: Dict) -> str:
    """Get color for a tag, with fallback to defaults."""
    tag_colors = config.get("tag_colors", {})
    return tag_colors.get(tag_name, "#8E8E93")  # gray default


def _get_tag_weight(tag_name: str, config: Dict) -> Optional[int]:
    """Get weight for an auto-tag based on its category."""
    category_weights = config.get("category_weights", {"frequency": 50, "recency": 50, "spending": 50})
    
    # mapping tag names to categories
    frequency_tags = {"First Visit", "Returning", "Regular", "Loyal"}
    recency_tags = {"Active", "At Risk", "Inactive"}
    spending_tags = {"New Client", "Regular Spender", "High Value", "Premium"}
    
    if tag_name in frequency_tags:
        return category_weights.get("frequency")
    elif tag_name in recency_tags:
        return category_weights.get("recency")
    elif tag_name in spending_tags:
        return category_weights.get("spending")
    
    return None  # if it doesn't have a category, it doesn't have a weight


def analyze_service_preferences(db, bookings: List[Dict], services: List[Dict]) -> List[Dict]:
    """Analyze service booking patterns.
    
    Service Explorer: Uses >3 different services
    Loyal to One: Uses 1-2 services consistently
    Premium Add-ons: Frequently books high-priced services
    """
    if not bookings or not services:
        return []
    
    service_tags = []
    service_map = {s.get("id"): s.get("price", 0) for s in services}
    
    # Count unique services
    unique_services = set()
    premium_service_count = 0
    
    for booking in bookings:
        service_id = booking.get("service_id")
        if service_id:
            unique_services.add(service_id)
            # Check if service is premium (top 25%)
            if service_id in service_map:
                service_price = service_map[service_id]
                all_prices = list(service_map.values())
                if all_prices:
                    price_threshold = sorted(all_prices)[int(len(all_prices) * 0.75)]
                    if service_price >= price_threshold:
                        premium_service_count += 1
    
    num_unique = len(unique_services)
    
    if num_unique > 3:
        service_tags.append({"id": "auto:Service Explorer", "tag": "Service Explorer", "color": "#42BBEB", "auto": True})
    elif num_unique in [1, 2]:
        service_tags.append({"id": "auto:Loyal to One", "tag": "Loyal to One", "color": "#34C759", "auto": True})
    
    # If more than 40% of bookings are for premium services, tag as Premium
    if len(bookings) > 0 and (premium_service_count / len(bookings)) > 0.4:
        service_tags.append({"id": "auto:Premium Add-ons", "tag": "Premium Add-ons", "color": "#FF9500", "auto": True})
    
    return service_tags


def analyze_communication_behavior(db, customer_id: str, provider_id: str, bookings: List[Dict]) -> List[Dict]:
    """Analyze communication patterns relative to bookings.
    
    Quick Responder: Avg response time < 2 hours
    Inquiring: Many messages before booking (>5 messages typical)
    Direct Booker: Few messages, books quickly
    """
    comm_tags = []
    
    try:
        # Get convo data for user
        convos = db.collection("conversations").where(
            "customer_id", "==", customer_id
        ).where(
            "provider_id", "==", provider_id
        ).get()
        
        if not convos:
            return comm_tags
        
        total_messages = 0
        response_times = []
        
        for convo in convos:
            convo_data = convo.to_dict()
            messages = convo_data.get("messages", [])
            total_messages += len(messages)
            
            # Checking response times between the messages
            for i, msg in enumerate(messages[1:], 1):
                prev_msg = messages[i-1]
                try:
                    prev_time = prev_msg.get("timestamp")
                    curr_time = msg.get("timestamp")
                    
                    if prev_time and curr_time:
                        if isinstance(prev_time, str):
                            prev_time = datetime.fromisoformat(prev_time)
                        if isinstance(curr_time, str):
                            curr_time = datetime.fromisoformat(curr_time)
                        
                        if prev_time.tzinfo is None:
                            prev_time = prev_time.replace(tzinfo=timezone.utc)
                        if curr_time.tzinfo is None:
                            curr_time = curr_time.replace(tzinfo=timezone.utc)
                        
                        response_seconds = (curr_time - prev_time).total_seconds()
                        response_times.append(response_seconds)
                except Exception:
                    continue
        
        # Set catgeory based on the pattern
        if response_times:
            avg_response_hours = (sum(response_times) / len(response_times)) / 3600
            if avg_response_hours < 2:
                comm_tags.append({"id": "auto:Quick Responder", "tag": "Quick Responder", "color": "#34C759", "auto": True})
        
        # Checking messages per booking
        if len(bookings) > 0:
            messages_per_booking = total_messages / len(bookings)
            
            if messages_per_booking > 5:
                comm_tags.append({"id": "auto:Inquiring", "tag": "Inquiring", "color": "#42BBEB", "auto": True})
            elif messages_per_booking < 2:
                comm_tags.append({"id": "auto:Direct Booker", "tag": "Direct Booker", "color": "#8E8E93", "auto": True})
    
    except Exception:
        # if no conversation data, return empty - really depends on there being a convo otherwise maybe i should return a error? - confirm tomorrow in meeting
        pass
    
    return comm_tags


def resolve_tag_priority(manual_tags: List[Dict], auto_tags: List[Dict], priority_mode: str = "auto_first") -> List[Dict]:
    """Resolve conflicts based on user preference for tag prio
    
    priority_mode:
    - "auto_first": Auto-tags would take precedence over manual tags with the same name
    - "manual_first": Manual tags take precedence (I kinda want this to be default behavior)
    - "merge": Keep both, mark auto-generated separately
    """
    if priority_mode == "merge" or priority_mode == "manual_first":
        # For both of these, manual tags would be needed/take preference, its only in auto-first manual would be overridden
        manual_names = {t.get("tag") for t in manual_tags}
        merged = manual_tags + [t for t in auto_tags if t.get("tag") not in manual_names]
        return merged
    
    elif priority_mode == "auto_first":
        # Auto overriddes manual
        auto_names = {t.get("tag"): t for t in auto_tags}
        result = [t for t in manual_tags if t.get("tag") not in auto_names]
        result.extend(auto_tags)
        return result
    
    return manual_tags + auto_tags


def calculate_auto_tags(db, provider_id: str, customer_id: str, bookings: List[Dict], config: Optional[Dict] = None) -> List[Dict]:
    """Calculate basic automatic tags: frequency, recency, spending.

    Returns a list of tag dicts compatible with the snapshot `tags` format.
    """
    if config is None:
        config = get_provider_tagging_config(db, provider_id)
    
    if not config.get("enabled", True):
        return []
    
    total_visits = len(bookings)
    total_spent = sum(b.get("cost", 0) for b in bookings)

    last_service_date = None
    if bookings:
        latest = bookings[0]
        last_service_date = latest.get("date")

    auto_tags = []
    
    # Grabbing thresholds from the config
    freq_thresh = config.get("frequency_thresholds", {"returning": 2, "regular": 5, "loyal": 10})
    spend_thresh = config.get("spending_thresholds", {"regular_spender": 100, "high_value": 500, "premium": 1000})
    recency_thresh = config.get("recency_thresholds", {"active_days": 30, "at_risk_days": 180})

    # Frequency tags
    if total_visits == 1:
        auto_tags.append({"id": "auto:First Visit", "tag": "First Visit", "color": _get_tag_color("First Visit", config), "auto": True})
    elif total_visits < freq_thresh.get("regular", 5):
        auto_tags.append({"id": "auto:Returning", "tag": "Returning", "color": _get_tag_color("Returning", config), "auto": True})
    elif total_visits < freq_thresh.get("loyal", 10):
        auto_tags.append({"id": "auto:Regular", "tag": "Regular", "color": _get_tag_color("Regular", config), "auto": True})
    elif total_visits >= freq_thresh.get("loyal", 10):
        auto_tags.append({"id": "auto:Loyal", "tag": "Loyal", "color": _get_tag_color("Loyal", config), "auto": True})

    # Recency tags
    days = _days_since(last_service_date)
    active_threshold = recency_thresh.get("active_days", 30)
    at_risk_threshold = recency_thresh.get("at_risk_days", 180)
    
    if total_visits == 0:
        pass
    else:
        if days <= active_threshold:
            auto_tags.append({"id": "auto:Active", "tag": "Active", "color": _get_tag_color("Active", config), "auto": True})
        elif days <= at_risk_threshold:
            auto_tags.append({"id": "auto:At Risk", "tag": "At Risk", "color": _get_tag_color("At Risk", config), "auto": True})
        else:
            auto_tags.append({"id": "auto:Inactive", "tag": "Inactive", "color": _get_tag_color("Inactive", config), "auto": True})

    # Spending tags
    regular_threshold = spend_thresh.get("regular_spender", 100)
    high_value_threshold = spend_thresh.get("high_value", 500)
    premium_threshold = spend_thresh.get("premium", 1000)
    
    if total_spent < regular_threshold:
        auto_tags.append({"id": "auto:New Client", "tag": "New Client", "color": _get_tag_color("New Client", config), "auto": True})
    elif total_spent < high_value_threshold:
        auto_tags.append({"id": "auto:Regular Spender", "tag": "Regular Spender", "color": _get_tag_color("Regular Spender", config), "auto": True})
    elif total_spent < premium_threshold:
        auto_tags.append({"id": "auto:High Value", "tag": "High Value", "color": _get_tag_color("High Value", config), "auto": True})
    else:
        if total_spent >= premium_threshold:
            auto_tags.append({"id": "auto:Premium", "tag": "Premium", "color": _get_tag_color("Premium", config), "auto": True})

    # Behavioural - booking tags
    enable_phases = config.get("enable_phases", {"phase1": True, "phase2": True, "phase3": True, "phase4": True})
    if enable_phases.get("phase2", True):
        booking_pattern_tags = analyze_booking_patterns(bookings)
        auto_tags.extend(booking_pattern_tags)
        
        # Behavioural - time preference tags
        time_preference_tags = analyze_time_preferences(bookings)
        auto_tags.extend(time_preference_tags)
        
        # Behavioural - cancellation tags
        cancellation_tags = analyze_cancellation_behavior(bookings)
        auto_tags.extend(cancellation_tags)
    
    # Service preference tags
    if enable_phases.get("phase3", True):
        # Get services for this provider
        try:
            services_docs = db.collection("services").where("provider_id", "==", provider_id).get()
            services = [s.to_dict() for s in services_docs]
            
            service_pref_tags = analyze_service_preferences(db, bookings, services)
            auto_tags.extend(service_pref_tags)
        except Exception:
            pass
        
        # Communication behavior analysis
        try:
            comm_tags = analyze_communication_behavior(db, customer_id, provider_id, bookings)
            auto_tags.extend(comm_tags)
        except Exception:
            pass
    
    # Apply color from config to all tags, in the event they were made with defaults
    for tag in auto_tags:
        tag_name = tag.get("tag", "")
        if tag_name:
            tag["color"] = _get_tag_color(tag_name, config)
            # Adding in the weight for categorical tags
            weight = _get_tag_weight(tag_name, config)
            if weight:
                tag["weight"] = weight

    return auto_tags


def analyze_booking_patterns(bookings: List[Dict]) -> List[Dict]:
    """Analyze booking lead time patterns to identify behavior.
    
    Last Minute: >50% bookings made < 24hrs before
    Planner: >50% bookings made > 7 days before
    Consistent: Books at regular intervals
    Spot Booker: Random/inconsistent booking patterns
    """
    if not bookings:
        return []
    
    pattern_tags = []
    
    # Find time between booking creation and service date for the bookings
    lead_times = []
    for booking in bookings:
        try:
            booking_date = booking.get("created_at") or booking.get("date")
            service_date = booking.get("date")
            
            if not booking_date or not service_date:
                continue
            
            # Parse dates if strings, gotta make sure
            if isinstance(booking_date, str):
                booking_date = datetime.fromisoformat(booking_date)
            if isinstance(service_date, str):
                service_date = datetime.fromisoformat(service_date)
            
            # Handle timezone-naive vs aware
            if booking_date.tzinfo is None:
                booking_date = booking_date.replace(tzinfo=timezone.utc)
            if service_date.tzinfo is None:
                service_date = service_date.replace(tzinfo=timezone.utc)
            
            lead_days = max(0, (service_date - booking_date).days)
            lead_times.append(lead_days)
        except Exception:
            continue
    
    if not lead_times:
        return pattern_tags
    
    # Analyze lead time patterns
    last_minute_count = sum(1 for lt in lead_times if lt < 1)  # < 24 hours
    planner_count = sum(1 for lt in lead_times if lt > 7)  # > 7 days
    
    last_minute_pct = (last_minute_count / len(lead_times)) * 100 if lead_times else 0
    planner_pct = (planner_count / len(lead_times)) * 100 if lead_times else 0
    
    if last_minute_pct > 50:
        pattern_tags.append({"id": "auto:Last Minute", "tag": "Last Minute", "color": "#FF3B30", "auto": True})
    elif planner_pct > 50:
        pattern_tags.append({"id": "auto:Planner", "tag": "Planner", "color": "#34C759", "auto": True})
    else:
        # Check for regular intervals
        if len(lead_times) >= 3:
            intervals = []
            for i in range(len(lead_times) - 1):
                intervals.append(abs(lead_times[i] - lead_times[i+1]))
            
            if intervals and sum(intervals) / len(intervals) < 5:  # low variance
                pattern_tags.append({"id": "auto:Consistent", "tag": "Consistent", "color": "#42BBEB", "auto": True})
            else:
                pattern_tags.append({"id": "auto:Spot Booker", "tag": "Spot Booker", "color": "#8E8E93", "auto": True})
        else:
            pattern_tags.append({"id": "auto:Spot Booker", "tag": "Spot Booker", "color": "#8E8E93", "auto": True})
    
    return pattern_tags


def analyze_time_preferences(bookings: List[Dict]) -> List[Dict]:
    """Analyze booking times to identify time and day preferences.
    
    Morning: >60% bookings before 12pm
    Afternoon: >60% bookings 12pm-5pm
    Evening: >60% bookings after 5pm
    Weekend Preferred: >60% bookings on Sat/Sun
    Weekday: >60% bookings on Mon-Fri
    """
    if not bookings:
        return []
    
    time_tags = []
    times_of_day = []
    days_of_week = []
    
    for booking in bookings:
        try:
            service_date = booking.get("date")
            service_time = booking.get("time") or booking.get("start_time")
            
            if not service_date:
                continue
            
            # Parse date
            if isinstance(service_date, str):
                dt = datetime.fromisoformat(service_date)
            else:
                dt = service_date
            
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            
            days_of_week.append(dt.weekday())  # 0-6, 0 = Monday
            
            # Parse time if available
            if service_time:
                if isinstance(service_time, str):
                    time_parts = service_time.split(":")
                    hour = int(time_parts[0])
                else:
                    hour = service_time.hour if hasattr(service_time, 'hour') else 12
                
                times_of_day.append(hour)
        except Exception:
            continue
    
    if times_of_day:
        morning_count = sum(1 for h in times_of_day if h < 12)
        afternoon_count = sum(1 for h in times_of_day if 12 <= h < 17)
        evening_count = sum(1 for h in times_of_day if h >= 17)
        
        total_time_bookings = len(times_of_day)
        
        if morning_count / total_time_bookings > 0.6:
            time_tags.append({"id": "auto:Morning Person", "tag": "Morning Person", "color": "#FFCC00", "auto": True})
        elif afternoon_count / total_time_bookings > 0.6:
            time_tags.append({"id": "auto:Afternoon", "tag": "Afternoon", "color": "#FF9500", "auto": True})
        elif evening_count / total_time_bookings > 0.6:
            time_tags.append({"id": "auto:Evening", "tag": "Evening", "color": "#AF52DE", "auto": True})
    
    if days_of_week:
        weekend_count = sum(1 for d in days_of_week if d >= 5)  # Sat=5, Sun=6
        weekday_count = sum(1 for d in days_of_week if d < 5)
        
        total_day_bookings = len(days_of_week)
        
        if weekend_count / total_day_bookings > 0.6:
            time_tags.append({"id": "auto:Weekend Preferred", "tag": "Weekend Preferred", "color": "#42BBEB", "auto": True})
        elif weekday_count / total_day_bookings > 0.6:
            time_tags.append({"id": "auto:Weekday", "tag": "Weekday", "color": "#34C759", "auto": True})
    
    return time_tags


def analyze_cancellation_behavior(bookings: List[Dict]) -> List[Dict]:
    """Analyze cancellation and no-show patterns.
    
    Reliable: <10% cancellation rate
    Sometimes Late: 10-30% cancellation/no-show rate
    Frequent Canceller: >30% cancellation rate
    """
    if not bookings:
        return []
    
    # Count all bookings, including cancelled and all that
    total_bookings = len(bookings)
    if total_bookings == 0:
        return []
    
    # This assumes all bookings in the list are confirmed/completed ones passed from snapshot
    # This should be updated to query all status types though
    cancelled_count = sum(1 for b in bookings if b.get("status") in ["cancelled", "no_show", "rescheduled"])
    no_show_count = sum(1 for b in bookings if b.get("status") == "no_show")
    
    cancellation_rate = ((cancelled_count + no_show_count) / total_bookings * 100) if total_bookings > 0 else 0
    
    behavior_tags = []
    
    if cancellation_rate < 10:
        behavior_tags.append({"id": "auto:Reliable", "tag": "Reliable", "color": "#34C759", "auto": True})
    elif cancellation_rate <= 30:
        behavior_tags.append({"id": "auto:Sometimes Late", "tag": "Sometimes Late", "color": "#FF9500", "auto": True})
    else:
        behavior_tags.append({"id": "auto:Frequent Canceller", "tag": "Frequent Canceller", "color": "#FF3B30", "auto": True})
    
    return behavior_tags
