// Use FastAPI backend instead of CSV parsing
export const loadAndCleanData = async () => {
  console.log('Loading data from FastAPI backend...');
  
  try {
    const response = await fetch('/api/data?limit=10000');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`Loaded ${result.sampled_rows} rows from ${result.total_rows} total`);

    const normalizeState = (state) => {
      if (!state) return "Unknown";
      let s = String(state).trim();
      // Remove junk values like "100000"
      if (/^\d+$/.test(s)) return "Unknown";
      // Normalize common formatting quirks
      s = s.replace(/^the\s+/i, "");
      s = s.replace(/&/g, "and").replace(/\s+/g, " ");
      const lower = s.toLowerCase();
      const map = {
        "andaman & nicobar islands": "Andaman And Nicobar Islands",
        "andaman and nicobar islands": "Andaman And Nicobar Islands",
        "dadra and nagar haveli": "Dadra And Nagar Haveli And Daman And Diu",
        "daman and diu": "Dadra And Nagar Haveli And Daman And Diu",
        "dadra and nagar haveli and daman and diu": "Dadra And Nagar Haveli And Daman And Diu",
        "the dadra and nagar haveli and daman and diu": "Dadra And Nagar Haveli And Daman And Diu",
        "nct of delhi": "Nct Of Delhi",
        delhi: "Nct Of Delhi",
        orissa: "Odisha",
        pondicherry: "Puducherry",
        "jammu & kashmir": "Jammu And Kashmir",
        westbengal: "West Bengal",
        "west bangal": "West Bengal",
      };
      if (map[lower]) return map[lower];
      return lower
        .split(" ")
        .map((w) => (w === "and" || w === "of" ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(" ");
    };

    const normalizeDistrict = (district) => {
      if (!district) return "Unknown";
      return String(district).trim().replace(/\s+/g, " ");
    };
    
    // Convert date strings back to Date objects
    const data = result.data.map(row => ({
      ...row,
      date: new Date(row.date),
      state: normalizeState(row.state),
      district: normalizeDistrict(row.district),
    }));
    
    console.log('Data ready:', data.length, 'rows');
    return data;
    
  } catch (error) {
    console.error('Error loading from backend:', error);
    throw new Error('Failed to load data from backend. Start the Python API on port 8000 and refresh.');
  }
};

const cleanData = (data) => {
  console.log('Starting data cleaning...');
  console.log('Raw data sample:', data[0]);
  
  // Much simpler filtering - only remove completely empty rows
  let cleaned = data.filter(row => 
    row && row.date && row.state && row.district
  );
  
  console.log(`After basic filtering: ${cleaned.length} rows`);

  // Limit to prevent browser freeze - take a sample for better performance
  const sampleSize = 10000; // Use 10k rows for smooth performance
  const step = Math.floor(cleaned.length / sampleSize);
  const sampled = step > 1 ? cleaned.filter((_, idx) => idx % step === 0) : cleaned;
  
  console.log(`Using ${sampled.length} rows for dashboard`);

  // Parse dates and calculate totals with minimal validation
  const processed = sampled.map((row, idx) => {
    if (idx % 1000 === 0) {
      console.log(`Processing row ${idx}/${sampled.length}...`);
    }
    
    try {
      // Try to parse date in multiple formats
      let date;
      if (row.date.includes('-')) {
        const parts = row.date.split('-');
        // Try DD-MM-YYYY format
        date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        if (isNaN(date.getTime())) {
          // Try YYYY-MM-DD format
          date = new Date(row.date);
        }
      } else {
        date = new Date(row.date);
      }
      
      if (isNaN(date.getTime())) {
        return null;
      }
      
      const age_0_5 = parseFloat(row.age_0_5) || 0;
      const age_5_17 = parseFloat(row.age_5_17) || 0;
      const age_18_greater = parseFloat(row.age_18_greater) || 0;
      const total_enrolments = age_0_5 + age_5_17 + age_18_greater;

      return {
        date,
        age_0_5,
        age_5_17,
        age_18_greater,
        total_enrolments,
        year: date.getFullYear(),
        month: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
        day_of_week: date.toLocaleDateString('en-US', { weekday: 'long' }),
        state: String(row.state || '').trim(),
        district: String(row.district || '').trim()
      };
    } catch (err) {
      console.error('Error processing row:', err);
      return null;
    }
  }).filter(row => row !== null && row.total_enrolments >= 0);

  console.log(`After parsing: ${processed.length} rows`);

  if (processed.length === 0) {
    console.error('No data after processing! Check CSV format');
    console.log('Sample raw row:', data[0]);
    return [];
  }
  
  return processed;
};

const cleanStateName = (state) => {
  if (!state) return 'Unknown';
  return String(state).trim();
};

const cleanDistrictName = (district) => {
  if (!district) return 'Unknown';
  return String(district).trim();
};

const removeDuplicates = (data) => {
  // Simplified - just return data for now
  return data;
};

const removeOutliers = (data) => {
  // Simplified - just return data for now
  return data;
};
