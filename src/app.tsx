import "./app.css";
import { DateTime, Duration } from "luxon";
import { useState } from "preact/hooks";
import { getTimeZones } from "@vvo/tzdb";

export function App() {
  const [input, setInput] = useState("");

  function calc(expression = input) {
    if (!expression) return DateTime.now().toRFC2822();
    
    // Check for timezone specification (ends with "in" followed by text)
    let targetTimezone = null;
    const inMatch = expression.match(/\s+in\s+(.+)$/i);
    if (inMatch) {
      const searchTerm = inMatch[1].trim().toLowerCase();
      const timezones = getTimeZones();
      
      // Simple fuzzy search function - calculates similarity score
      const fuzzyMatch = (text, term) => {
        text = text.toLowerCase();
        let score = 0;
        let termIndex = 0;
        
        for (let i = 0; i < text.length && termIndex < term.length; i++) {
          if (text[i] === term[termIndex]) {
            score++;
            termIndex++;
          }
        }
        
        return score / term.length; // Normalize by search term length
      };
      
      // Find best matching timezone
      let bestMatch = null;
      let bestScore = 0;
      
      for (const tz of timezones) {
        // Check both name and alternativeName
        const nameScore = fuzzyMatch(tz.name, searchTerm);
        const altNameScore = tz.alternativeName ? fuzzyMatch(tz.alternativeName, searchTerm) : 0;
        const score = Math.max(nameScore, altNameScore);
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = tz;
        }
      }
      
      if (bestMatch && bestScore > 0.5) { // Threshold for a reasonable match
        targetTimezone = bestMatch.name;
        // Remove the timezone part from the expression
        expression = expression.replace(inMatch[0], '');
      }
    }
    
    const toParse = expression.split(" ");

    // combine elements not seperated by "+", "-"
    let combined = [];
    let temp = "";
    for (let i = 0; i < toParse.length; i++) {
      if (toParse[i] !== "+" && toParse[i] !== "-") {
        temp += " " + toParse[i];
      } else {
        combined.push(temp);
        combined.push(toParse[i]);
        temp = "";
      }
    }
    combined.push(temp);

    for (let i = 0; i < combined.length; i++) {
      // if it contains "am" or "pm", convert it to a DateTime
      if (
        combined[i].toLowerCase().includes("am") ||
        combined[i].toLowerCase().includes("pm")
      ) {
        const value = combined[i].trim();
        // Support both "1pm" and "1:30pm" formats
        const format = value.includes(":") ? "h:mma" : "ha";
        combined[i] = DateTime.fromFormat(value, format);
      } else if (combined[i].toLowerCase().includes("now")) {
        combined[i] = DateTime.now();
      }
    }

    // convert elements with time units into durations
    const timeUnitMap = {
      hour: "hours",
      hr: "hours",
      h: "hours",
      year: "years",
      yr: "years",
      day: "days",
      d: "days",
      month: "months",
      mo: "months",
      min: "minutes",
      m: "minutes",
      sec: "seconds",
      s: "seconds",
      // Add new abbreviations here easily
    };

    for (let i = 0; i < combined.length; i++) {
      if (typeof combined[i] === "string") {
        const value: string = combined[i].toLowerCase();
        for (const [abbr, unit] of Object.entries(timeUnitMap)) {
          if (value.includes(abbr)) {
            const num = value.replace(abbr, "").trim();
            combined[i] = Duration.fromObject({ [unit]: parseInt(num) });
            break;
          }
        }
      }
    }

    // calculate the result
    let result = DateTime.now();
    for (let i = 0; i < combined.length; i++) {
      if (combined[i] === "+") {
        if (combined[i + 1] instanceof Duration) {
          result = result.plus(combined[i + 1]);
        } else if (combined[i + 1] instanceof DateTime) {
          result = combined[i + 1];
        }
        i++;
      } else if (combined[i] === "-") {
        if (combined[i + 1] instanceof Duration) {
          result = result.minus(combined[i + 1]);
        } else if (combined[i + 1] instanceof DateTime) {
          result = combined[i + 1];
        }
        i++;
      } else if (combined[i] instanceof DateTime) {
        result = combined[i];
      }
    }
    
    // Set the timezone if specified
    if (targetTimezone) {
      result = result.setZone(targetTimezone);
    }
    
    return result.toLocaleString(DateTime.DATETIME_SHORT) + ` (${result.zoneName})`;
  }

  return (
    <>
      <h1 class="title">TICA</h1>
      <div class="container">
        <input
          class="calc"
          placeholder="type here..."
          value={input}
          onInput={(e) => setInput(e.currentTarget.value)}
        />
        <p class="result">{calc()}</p>
      </div>
    </>
  );
}
