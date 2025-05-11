"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const openai_1 = require("openai");
const config_1 = __importDefault(require("../config/config"));
const logger_1 = __importDefault(require("../utils/logger"));
const fileManager_1 = require("../utils/fileManager");
class AIService {
    constructor() {
        this.openai = new openai_1.OpenAI({
            apiKey: config_1.default.apis.openai.key
        });
    }
    generateSarcasticContent(newsItem) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`Generating content for news item: ${newsItem.id}`);
                const prompt = this.buildPrompt(newsItem);
                const response = yield this.openai.chat.completions.create({
                    model: config_1.default.apis.openai.model,
                    messages: [
                        {
                            role: 'system',
                            content: `You are PotatoHead, a quirky potato-headed news announcer who reports on weird, mysterious, and unexplained news for short-form TikTok videos.

Your PERSONALITY is a mix of:
- Deadpan humor with occasional sarcastic comments
- Conspiracy-curious but not conspiracy-convinced
- Slightly dramatic with news-anchor energy
- Fascinated by the bizarre and unexplained
- Think: a blend of a serious news anchor + quirky internet personality

Your TikTok-optimized structure (CRITICAL):
1. FIRST 3 SECONDS: Start with the most shocking/bizarre element presented as a fact → "Scientists discovered a glowing object that DISAPPEARS when approached..."
2. QUICK CONTEXT: Who, what, where in 1-2 sentences max
3. THE WEIRD OR INTERESTING PART: The unexplained element that makes this story fascinating
4. END WITH: Either a thought-provoking question OR a slightly sarcastic comment

ESSENTIAL STYLE ELEMENTS:
- Use SHORT sentences (3-5 words is ideal)
- Include at least one EMPHASIS word in ALL CAPS per sentence
- Add occasional "dramatic pauses" with "..." for timing
- Instead of rigid transition phrases, use a DYNAMIC approach:
  * Match transition style to content tone (mysterious/funny/shocking)
  * Keep transitions ultra-brief (1-3 words)
  * Vary your delivery pattern across videos
  * Use natural speech patterns that feel conversational
  
  Examples by content type:
  * MYSTERY: "But wait..." "The twist?" "Strangely..." "No explanation..."
  * FUNNY: "Get this..." "Then suddenly..." "Plot twist..." "It gets worse..."
  * SHOCKING: "Even weirder..." "Unbelievably..." "Here's proof..." "Scientists found..."
  
  IMPORTANT: Never use the same transition twice in one video, and try to use different transitions across videos to maintain freshness.
- End with thought-provoking questions that feel genuine:
    ENDING STRATEGY:
    - Create an ULTRA-BRIEF 3-5 word engagement prompt that:
      1. Uses the MINIMUM words needed to prompt a response
      2. Contains ONE word in ALL CAPS for emphasis
      3. Directly connects to the most UNUSUAL element of this specific story
      4. Is impossible to reuse for other stories
      5. Can be delivered in 1-2 seconds of speaking time
    
    Examples of ultra-brief endings:
    - For UFO story: 'Seen anything SIMILAR?'
    - For strange creature: 'WEIRDEST animal encountered?'
    - For conspiracy: 'Sound SUSPICIOUS?'
    - For unexplained event: 'EXPLAIN this?'
    - For funny fail: 'Rate their SKILLS'
    - For bizarre discovery: 'BELIEVE this?'

The prompt should be the perfect conversation starter that feels natural to respond to in a comment.
Keep under 40-50 words total for maximum engagement. This should be ~15-20 seconds when read aloud.`
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7, // Balanced between creativity and coherence
                    max_tokens: 350 // Increased tokens to allow for content + image terms + sentiment
                });
                const rawText = response.choices[0].message.content || '';
                // Parse the response to extract commentary, image search terms and content type
                const { commentary, imageTerms, contentType } = this.parseResponse(rawText);
                const content = {
                    id: (0, fileManager_1.generateId)(),
                    newsItemId: newsItem.id,
                    rawText: commentary, // Use the cleaned commentary
                    sentiment: contentType || this.analyzeSentiment(commentary),
                    imageSearchTerms: imageTerms, // Store the image search terms
                    createdAt: new Date()
                };
                // Save the generated content
                const filename = `content_${content.id}.json`;
                (0, fileManager_1.saveJsonToFile)(content, config_1.default.paths.content, filename);
                logger_1.default.info(`Generated content with ID: ${content.id}, image terms: ${imageTerms.join(', ')}`);
                return content;
            }
            catch (error) {
                logger_1.default.error(`Failed to generate content: ${error}`);
                throw new Error(`Failed to generate content: ${error}`);
            }
        });
    }
    buildPrompt(newsItem) {
        return `Create a HIGHLY ADDICTIVE TikTok news announcement for PotatoHead News about this story:
    
HEADLINE: ${newsItem.title}
SOURCE: ${newsItem.source}
CONTENT: ${newsItem.content}
    
First, determine which category this story MOST belongs to:
- SCIENTIFIC DISCOVERY (if it describes something scientists have explained or discovered)
- MYSTERY/UNEXPLAINED (if it describes something still unexplained or mysterious)
- FUNNY/LIGHTHEARTED (if it's amusing, ridiculous, or light-hearted)

IMPORTANT: Do NOT use "Scientists can't explain THIS..." for Scientific Discovery stories where scientists HAVE actually explained something!

PROVIDE THREE OUTPUTS IN EXACTLY THIS FORMAT:

COMMENTARY: Your actual script for PotatoHead to read
IMAGE_SEARCH_TERMS: 3-5 specific terms to search for a perfect image representing this story (be very specific)
CONTENT_TYPE: one of the following: mystery, weird, unexplained, cryptid, paranormal, funny

For the COMMENTARY:
- VIRAL HOOK: Choose the appropriate style based on your content type determination:
  
  IF FUNNY/LIGHTHEARTED:
  * "This might be the FUNNIEST thing you'll see today..."
  * "Wait until you see what this person ACTUALLY did..."
  * "I've never seen anything this RIDICULOUS..."
  * "You won't BELIEVE what just happened..."
  * Use a more playful, amused tone throughout

  IF SCIENTIFIC DISCOVERY:
  * "Scientists just SOLVED a mystery..."
  * "Researchers finally DISCOVERED..."
  * "New study REVEALS something incredible..."
  * "The science behind THIS is fascinating..."
  * Use an excited, informative tone

  IF MYSTERY/UNEXPLAINED:
  * "Scientists can't explain THIS..."
  * "This phenomenon BAFFLES experts..."
  * "No one understands HOW this happens..."
  * "The mystery that science can't CRACK..."
  * Use a mysterious, intrigued tone throughout
  
  IF YOU NEED A NEW HOOK: Create one that follows the same pattern (3-7 words with ONE emphasized word) but uses different phrasing than previous hooks. Focus on the main emotion of the story (surprise, discovery, mystery, humor, etc).
  
- STRUCTURE FOR MAXIMUM VIEWER RETENTION:
  1. First 3 seconds: Most shocking claim phrased as a statement (NOT a question)
  2. Quick context (3-5 seconds): Minimal but essential details
  3. Twist element (5-10 seconds): The unexpected/bizarre aspect that creates intrigue
  4. Loop close (2-3 seconds): End with something that makes viewers want to rewatch or comment

COMMENTARY REQUIREMENTS:
- Sound like a REAL HUMAN speaking naturally on TikTok
- Use contractions (don't, can't, won't, etc.)
- Include at least one word in ALL CAPS in each sentence for emphasis
- Keep sentences extremely short (3-5 words is ideal)
- Use "..." for strategic pauses, especially before revealing key information
- Keep total word count under 45-55 words
- Use conversational, internet-savvy language that feels authentic

Respond AS PotatoHead. Include ALL THREE sections (COMMENTARY, IMAGE_SEARCH_TERMS, CONTENT_TYPE) in your response.`;
    }
    /**
     * Parse the response to extract commentary, image search terms, and content type
     */
    parseResponse(text) {
        // Initialize with defaults
        let commentary = '';
        let imageTerms = [];
        let contentType = null;
        // Extract the commentary section
        // @ts-ignore
        const commentaryMatch = text.match(/COMMENTARY:(.*?)(?=IMAGE_SEARCH_TERMS:|CONTENT_TYPE:|$)/s);
        if (commentaryMatch && commentaryMatch[1]) {
            commentary = this.cleanBrackets(commentaryMatch[1].trim());
        }
        else {
            // If no sections found, assume the whole text is commentary
            commentary = this.cleanBrackets(text);
        }
        // Extract image search terms
        // @ts-ignore
        const imageTermsMatch = text.match(/IMAGE_SEARCH_TERMS:(.*?)(?=COMMENTARY:|CONTENT_TYPE:|$)/s);
        if (imageTermsMatch && imageTermsMatch[1]) {
            // Split by commas, clean up each term
            imageTerms = imageTermsMatch[1]
                .split(',')
                .map(term => term.trim())
                .filter(term => term.length > 0);
        }
        // Extract content type
        const contentTypeMatch = text.match(/CONTENT_TYPE:\s*(mystery|weird|unexplained|cryptid|paranormal|funny)/i);
        if (contentTypeMatch && contentTypeMatch[1]) {
            contentType = contentTypeMatch[1].toLowerCase();
        }
        return { commentary, imageTerms, contentType };
    }
    /**
     * Clean brackets and other formatting from the text
     */
    cleanBrackets(text) {
        // Remove section headers like [HOOK], [CONTEXT], etc.
        let cleanedText = text.replace(/\[(HOOK|CONTEXT|WEIRD ELEMENT|ENDING|.*?)\]\s*-?\s*/g, '');
        // Also catch any other square bracket content that might appear
        cleanedText = cleanedText.replace(/\[.*?\]/g, '');
        // Remove any remaining section markers
        cleanedText = cleanedText.replace(/^COMMENTARY:\s*/i, '');
        return cleanedText.trim();
    }
    analyzeSentiment(text) {
        const lowerText = text.toLowerCase();
        // Check for mystery indicators
        const mysteryIndicators = ['mystery', 'mysterious', 'unexplained', 'vanished', 'disappeared', 'unsolved', 'puzzle'];
        if (mysteryIndicators.some(indicator => lowerText.includes(indicator))) {
            return 'mystery';
        }
        // Check for weird indicators
        const weirdIndicators = ['weird', 'strange', 'bizarre', 'odd', 'unusual', 'peculiar', 'inexplicable'];
        if (weirdIndicators.some(indicator => lowerText.includes(indicator))) {
            return 'weird';
        }
        // Check for unexplained indicators
        const unexplainedIndicators = ['scientists baffled', 'experts confused', 'no explanation', 'phenomenon', 'supernatural'];
        if (unexplainedIndicators.some(indicator => lowerText.includes(indicator))) {
            return 'unexplained';
        }
        // Check for funny indicators
        const funnyIndicators = ['funny', 'hilarious', 'laugh', 'comedy', 'ridiculous'];
        if (funnyIndicators.some(indicator => lowerText.includes(indicator))) {
            return 'funny';
        }
        return 'neutral';
    }
}
exports.AIService = AIService;
