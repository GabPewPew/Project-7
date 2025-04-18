import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load SRS configuration
const srsConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../config/srs.json'), 'utf8')
);

// Add jitter/fuzz to intervals to prevent cards from stacking up
function fuzzyInterval(interval) {
  if (interval < 2) return interval; // No fuzz for intervals < 2
  
  // Random value between -5% and +5%
  const fuzz = 1.0 + (Math.random() * 0.1 - 0.05);
  return Math.max(1, Math.round(interval * fuzz));
}

// Get the next interval for a card in learning/relearning
function getNextLearningInterval(progress, quality, config, isRelearning = false) {
  const steps = isRelearning ? config.relearningStepsMinutes : config.learningStepsMinutes;
  
  if (quality === 1) { // Again - restart from first step
    return { 
      interval: steps[0] / 1440, // Convert minutes to days
      state: isRelearning ? 'relearning' : 'learning',
      step: 0
    };
  }
  
  if (quality === 2) { // Hard - stay at current step
    return { 
      interval: steps[progress.learningStep] / 1440, // Convert minutes to days
      state: isRelearning ? 'relearning' : 'learning',
      step: progress.learningStep
    };
  }
  
  // Quality 3 or 4 - move to next step
  const nextStep = progress.learningStep + 1;
  
  if (nextStep >= steps.length) {
    // Graduate to review
    return {
      interval: quality === 4 ? config.easyIntervalDays : config.graduatingIntervalDays,
      state: 'review',
      step: 0
    };
  }
  
  // Move to next step
  return {
    interval: steps[nextStep] / 1440, // Convert minutes to days
    state: isRelearning ? 'relearning' : 'learning',
    step: nextStep
  };
}

// Calculate new interval for a review card
function getReviewInterval(progress, quality, config) {
  // Card is in review state
  const currentInterval = progress.interval;
  const currentEase = progress.easeFactor;
  
  if (quality === 1) { // Again - move to relearning
    const newInterval = Math.max(1, Math.round(currentInterval * config.lapseNewIntervalPercent));
    const newEase = Math.max(config.minimumEaseFactor, currentEase - config.lapseEasePenalty);
    
    return {
      interval: config.relearningStepsMinutes[0] / 1440, // First relearning step in days
      state: 'relearning',
      easeFactor: newEase,
      step: 0,
      nextReviewInterval: newInterval // Save for when card graduates from relearning
    };
  }
  
  let intervalMultiplier;
  let easeChange;
  
  switch (quality) {
    case 2: // Hard
      intervalMultiplier = config.hardIntervalMultiplier;
      easeChange = -150; // -0.15
      break;
    case 3: // Good
      intervalMultiplier = currentEase / 1000; // Convert from permille
      easeChange = 0;
      break;
    case 4: // Easy
      intervalMultiplier = (currentEase / 1000) * config.easyBonus;
      easeChange = 150; // +0.15
      break;
  }
  
  // Calculate new interval and ease
  let newInterval = currentInterval * intervalMultiplier;
  
  // Apply interval modifier from config
  newInterval *= config.intervalModifier;
  
  // Apply fuzzy factor
  newInterval = fuzzyInterval(newInterval);
  
  // Cap at maximum interval
  newInterval = Math.min(newInterval, config.maximumInterval);
  
  // Update ease factor
  const newEase = Math.max(config.minimumEaseFactor, currentEase + easeChange);
  
  return {
    interval: newInterval,
    state: 'review',
    easeFactor: newEase,
    step: 0
  };
}

// Calculate next review based on current progress and response
export function calculateNextReview(currentProgress, quality, config = srsConfig) {
  // Convert quality from Anki's 1-4 scale if needed (again=1, hard=2, good=3, easy=4)
  if (typeof quality === 'string') {
    switch (quality) {
      case 'again': quality = 1; break;
      case 'hard': quality = 2; break;
      case 'good': quality = 3; break;
      case 'easy': quality = 4; break;
      default: throw new Error(`Invalid quality value: ${quality}`);
    }
  }
  
  // Clone current progress to avoid mutations
  const progress = { ...currentProgress };
  
  let result;
  
  // Determine next state based on current state and quality
  switch (progress.state) {
    case 'new':
      if (quality === 1) { // Again
        result = {
          interval: config.learningStepsMinutes[0] / 1440, // Convert minutes to days
          state: 'learning',
          step: 0
        };
      } else if (quality === 2) { // Hard
        result = {
          interval: config.learningStepsMinutes[0] / 1440, // Convert minutes to days
          state: 'learning',
          step: 0
        };
      } else if (quality === 3) { // Good
        if (config.learningStepsMinutes.length === 1) {
          // If only one learning step, go straight to review
          result = {
            interval: config.graduatingIntervalDays,
            state: 'review',
            step: 0
          };
        } else {
          result = {
            interval: config.learningStepsMinutes[0] / 1440, // Convert minutes to days
            state: 'learning',
            step: 0
          };
        }
      } else { // Easy
        result = {
          interval: config.easyIntervalDays,
          state: 'review',
          step: 0
        };
      }
      break;
      
    case 'learning':
      result = getNextLearningInterval(progress, quality, config);
      break;
      
    case 'relearning':
      result = getNextLearningInterval(progress, quality, config, true);
      // If graduated from relearning, use the saved next review interval
      if (result.state === 'review' && progress.nextReviewInterval) {
        result.interval = progress.nextReviewInterval;
        delete progress.nextReviewInterval;
      }
      break;
      
    case 'review':
      result = getReviewInterval(progress, quality, config);
      break;
      
    default:
      throw new Error(`Invalid state: ${progress.state}`);
  }
  
  // Update progress with calculated values
  progress.state = result.state;
  progress.interval = result.interval;
  progress.easeFactor = result.easeFactor || progress.easeFactor;
  progress.learningStep = result.step;
  
  // Calculate due date
  const now = new Date();
  const dueDate = new Date(now);
  
  if (progress.state === 'learning' || progress.state === 'relearning') {
    // For learning steps, interval is in days (but fractional for minutes)
    // Add the minutes directly to get precise timing
    dueDate.setMinutes(dueDate.getMinutes() + Math.round(progress.interval * 1440));
  } else {
    // For review cards, interval is in days (integer)
    dueDate.setDate(dueDate.getDate() + Math.max(1, Math.round(progress.interval)));
  }
  
  progress.dueDate = dueDate;
  progress.lastReviewDate = now;
  progress.repetitions += 1;
  
  return progress;
}

// Export configuration for use elsewhere
export const config = srsConfig; 