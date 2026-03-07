import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/product.model';
import Order from '../models/order.model';
import connectDB from '../config/db';

dotenv.config();

connectDB();

const mockProducts = [
    // ─── GUITARS ──────────────────────────────────────────────────────────────
    {
        name: 'Fender American Professional II Stratocaster',
        category: 'Guitars',
        price: 1499,
        image: '/assets/product-bass.jpg',
        images: ['/assets/product-bass.jpg', '/assets/product-bass.jpg', '/assets/product-bass.jpg', '/assets/product-bass.jpg'],
        description: 'The American Professional II Stratocaster draws on over 60 years of innovation, inspiration, and evolution to meet the demands of today\'s working player.',
        rating: 5,
        reviews: 214,
        brand: 'Fender',
        condition: 'New',
        skillLevel: 'Professional',
        inStock: true,
        stockCount: 12,
        specifications: [
            { label: 'Body', value: 'Alder' },
            { label: 'Neck', value: 'Maple' },
            { label: 'Fretboard', value: 'Rosewood' },
            { label: 'Frets', value: '22 Narrow Tall' },
            { label: 'Pickups', value: 'V-Mod II Single-Coil x3' },
            { label: 'Finish', value: 'Olympic White' },
        ],
        customerReviews: [
            { id: 'r1', author: 'James Hetfield', rating: 5, date: '2 weeks ago', comment: 'Best Strat I\'ve ever played. The tone is just perfect.' },
            { id: 'r2', author: 'Maya Singh', rating: 5, date: '1 month ago', comment: 'Incredible build quality, stays in tune perfectly.' },
        ],
    },
    {
        name: 'Gibson Les Paul Standard 60s',
        category: 'Guitars',
        price: 2499,
        image: '/assets/product-bass.jpg',
        images: ['/assets/product-bass.jpg', '/assets/product-bass.jpg', '/assets/product-bass.jpg', '/assets/product-bass.jpg'],
        description: 'The Les Paul Standard \'60s returns to the classic design with mahogany body and AAA figured maple top producing warm, full sound.',
        rating: 5,
        reviews: 178,
        brand: 'Gibson',
        condition: 'New',
        skillLevel: 'Professional',
        inStock: true,
        stockCount: 8,
        specifications: [
            { label: 'Body', value: 'Mahogany with Figured Maple Top' },
            { label: 'Neck', value: 'Mahogany Rounded C' },
            { label: 'Fretboard', value: 'Rosewood' },
            { label: 'Frets', value: '22 Medium Jumbo' },
            { label: 'Pickups', value: 'Burstbucker 61R/61T Humbucker' },
            { label: 'Finish', value: 'Iced Tea Burst' },
        ],
        customerReviews: [
            { id: 'r3', author: 'Carlos Santana Jr.', rating: 5, date: '3 weeks ago', comment: 'Pure tone heaven. Worth every penny.' },
        ],
    },
    {
        name: 'Yamaha Pacifica 112V',
        category: 'Guitars',
        price: 399,
        image: '/assets/product-bass.jpg',
        images: ['/assets/product-bass.jpg', '/assets/product-bass.jpg', '/assets/product-bass.jpg', '/assets/product-bass.jpg'],
        description: 'A versatile beginner-to-intermediate guitar with HSS pickup configuration and alder body, renowned for exceptional playability and value.',
        rating: 4,
        reviews: 512,
        brand: 'Yamaha',
        condition: 'New',
        skillLevel: 'Beginner',
        inStock: true,
        stockCount: 35,
        specifications: [
            { label: 'Body', value: 'Alder' },
            { label: 'Neck', value: 'Maple' },
            { label: 'Fretboard', value: 'Rosewood' },
            { label: 'Pickups', value: 'HSS (Humbucker + 2 Single-Coil)' },
            { label: 'Bridge', value: 'Vintage-style tremolo' },
            { label: 'Finish', value: 'Sonic Blue' },
        ],
        customerReviews: [
            { id: 'r4', author: 'Leo Parker', rating: 5, date: '1 week ago', comment: 'Best beginner guitar on the market. Plays like a dream.' },
        ],
    },

    // ─── BASS ─────────────────────────────────────────────────────────────────
    {
        name: 'Fender Player Precision Bass',
        category: 'Bass',
        price: 849,
        image: '/assets/product-bass.jpg',
        images: ['/assets/product-bass.jpg', '/assets/product-bass.jpg', '/assets/product-bass.jpg', '/assets/product-bass.jpg'],
        description: 'A modern take on the iconic Precision Bass with the classic split-coil pickup delivering the deep, punchy tone that defined an era.',
        rating: 5,
        reviews: 134,
        brand: 'Fender',
        condition: 'New',
        skillLevel: 'Intermediate',
        inStock: true,
        stockCount: 20,
        specifications: [
            { label: 'Body', value: 'Alder' },
            { label: 'Neck', value: 'Maple Modern C' },
            { label: 'Fretboard', value: 'Pau Ferro' },
            { label: 'Scale Length', value: '34"' },
            { label: 'Pickups', value: 'Player Series Split Single-Coil' },
            { label: 'Strings', value: '4-string' },
        ],
        customerReviews: [
            { id: 'r5', author: 'John Paul', rating: 5, date: '2 weeks ago', comment: 'Punchy, rich P-bass tone. Incredible value.' },
        ],
    },
    {
        name: 'Music Man StingRay Special 4',
        category: 'Bass',
        price: 2199,
        originalPrice: 2499,
        onSale: true,
        image: '/assets/product-bass.jpg',
        images: ['/assets/product-bass.jpg', '/assets/product-bass.jpg', '/assets/product-bass.jpg', '/assets/product-bass.jpg'],
        description: 'The StingRay Special is a refinement of the already iconic StingRay, featuring a lightweight roasted maple neck and stunning new pickguard options.',
        rating: 5,
        reviews: 89,
        brand: 'Music Man',
        condition: 'New',
        skillLevel: 'Professional',
        inStock: true,
        stockCount: 5,
        specifications: [
            { label: 'Body', value: 'Swamp Ash' },
            { label: 'Neck', value: 'Roasted Maple' },
            { label: 'Fretboard', value: 'Roasted Maple' },
            { label: 'Scale Length', value: '34"' },
            { label: 'Pickups', value: 'Neodymium Humbucker' },
            { label: 'Strings', value: '4-string' },
        ],
        customerReviews: [
            { id: 'r6', author: 'Marcus Miller', rating: 5, date: '1 month ago', comment: 'The ultimate bass. Growly, versatile, and absolutely stunning.' },
        ],
    },

    // ─── DRUMS & PERCUSSION ───────────────────────────────────────────────────
    {
        name: 'Pearl Export EXX 5-Piece Drum Kit',
        category: 'Drums & Percussion',
        price: 899,
        image: '/assets/product-snare.jpg',
        images: ['/assets/product-snare.jpg', '/assets/product-snare.jpg', '/assets/product-snare.jpg', '/assets/product-snare.jpg'],
        description: 'The Export series remains the best-selling acoustic drum set in the world. Featuring poplar and Asian mahogany shells with Pearl\'s SST technology.',
        rating: 5,
        reviews: 289,
        brand: 'Pearl',
        condition: 'New',
        skillLevel: 'Beginner',
        inStock: true,
        stockCount: 15,
        specifications: [
            { label: 'Configuration', value: '5-piece' },
            { label: 'Bass Drum', value: '22" x 18"' },
            { label: 'Toms', value: '10", 12", 16"' },
            { label: 'Snare', value: '14" x 5.5"' },
            { label: 'Shell Material', value: 'Poplar/Asian Mahogany' },
            { label: 'Hardware', value: 'Complete set included' },
        ],
        customerReviews: [
            { id: 'r7', author: 'Phil Collins Jr.', rating: 5, date: '3 weeks ago', comment: 'Incredible kit for the price. Punchy and consistent across all sizes.' },
            { id: 'r8', author: 'Ringo Starkey', rating: 4, date: '2 months ago', comment: 'Very solid. Great for practice and small gigs.' },
        ],
    },
    {
        name: 'Ludwig Supraphonic Snare Drum',
        category: 'Drums & Percussion',
        price: 449,
        image: '/assets/product-snare.jpg',
        images: ['/assets/product-snare.jpg', '/assets/product-snare.jpg', '/assets/product-snare.jpg', '/assets/product-snare.jpg'],
        description: 'The Ludwig Supraphonic is the most recorded snare drum in history. Its pure aluminum shell produces a crisp, articulate sound that cuts through any mix.',
        rating: 5,
        reviews: 176,
        brand: 'Ludwig',
        condition: 'New',
        skillLevel: 'Professional',
        inStock: true,
        stockCount: 18,
        specifications: [
            { label: 'Shell Material', value: 'Aluminum' },
            { label: 'Diameter', value: '14"' },
            { label: 'Depth', value: '6.5"' },
            { label: 'Finish', value: 'Chrome-plated' },
            { label: 'Lugs', value: '10 lugs' },
            { label: 'Strainer', value: 'P85 Strainer' },
        ],
        customerReviews: [
            { id: 'r9', author: 'Stewart Copeland Jr.', rating: 5, date: '2 weeks ago', comment: 'The legend. Nothing else sounds like this snare.' },
        ],
    },
    {
        name: 'Roland TD-17KVX Electronic Drum Kit',
        category: 'Drums & Percussion',
        price: 1799,
        originalPrice: 1999,
        onSale: true,
        image: '/assets/product-snare.jpg',
        images: ['/assets/product-snare.jpg', '/assets/product-snare.jpg', '/assets/product-snare.jpg', '/assets/product-snare.jpg'],
        description: 'A premium-class electronic kit with mesh-head pads and an onboard sound module featuring hundreds of world-class drum tones.',
        rating: 5,
        reviews: 94,
        brand: 'Roland',
        condition: 'New',
        skillLevel: 'Intermediate',
        inStock: true,
        stockCount: 7,
        specifications: [
            { label: 'Configuration', value: '5-piece electronic kit' },
            { label: 'Snare Pad', value: 'PDX-12 Mesh Head' },
            { label: 'Cymbal Pads', value: 'CY-13R Ride, CY-12C Crash' },
            { label: 'Sound Module', value: 'TD-17' },
            { label: 'Onboard Sounds', value: '310 kits' },
            { label: 'Connectivity', value: 'USB, MIDI, Headphone, L/R Out' },
        ],
        customerReviews: [
            { id: 'r10', author: 'Dave Grohl Jr.', rating: 5, date: '1 month ago', comment: 'Perfect for apartment drumming. The mesh pads are nearly silent.' },
        ],
    },

    // ─── KEYBOARDS & PIANOS ───────────────────────────────────────────────────
    {
        name: 'Yamaha P-515 Digital Piano',
        category: 'Keyboards & Pianos',
        price: 1499,
        image: '/assets/product-headphones.jpg',
        images: ['/assets/product-headphones.jpg', '/assets/product-headphones.jpg', '/assets/product-headphones.jpg', '/assets/product-headphones.jpg'],
        description: 'The flagship portable piano featuring Yamaha\'s GrandTouch keyboard and 38 premium instrument voices with realistic acoustic piano resonance.',
        rating: 5,
        reviews: 201,
        brand: 'Yamaha',
        condition: 'New',
        skillLevel: 'Professional',
        inStock: true,
        stockCount: 9,
        specifications: [
            { label: 'Keys', value: '88 Weighted GrandTouch' },
            { label: 'Polyphony', value: '256 notes' },
            { label: 'Voices', value: '38 premium sounds' },
            { label: 'Speakers', value: '4 x 20W' },
            { label: 'Bluetooth', value: 'Yes (Audio + MIDI)' },
            { label: 'Connectivity', value: 'USB, MIDI, Stereo Out' },
        ],
        customerReviews: [
            { id: 'r11', author: 'Lang Lang Jr.', rating: 5, date: '2 weeks ago', comment: 'The key action is almost indistinguishable from a real grand piano.' },
        ],
    },
    {
        name: 'Roland JUNO-DS88 Synthesizer',
        category: 'Keyboards & Pianos',
        price: 1099,
        image: '/assets/product-headphones.jpg',
        images: ['/assets/product-headphones.jpg', '/assets/product-headphones.jpg', '/assets/product-headphones.jpg', '/assets/product-headphones.jpg'],
        description: 'A powerful 88-key synthesizer with 1,600+ high-quality sounds, onboard arpeggiator, and battery-powered operation for ultimate flexibility.',
        rating: 4,
        reviews: 118,
        brand: 'Roland',
        condition: 'New',
        skillLevel: 'Intermediate',
        inStock: true,
        stockCount: 11,
        specifications: [
            { label: 'Keys', value: '88 Semi-weighted' },
            { label: 'Sounds', value: '1,600+ patches' },
            { label: 'Polyphony', value: '128 notes' },
            { label: 'Arpeggiator', value: 'Yes' },
            { label: 'Battery Power', value: '8x AA batteries' },
            { label: 'Connectivity', value: 'USB, MIDI, L/R Out, Headphone' },
        ],
        customerReviews: [
            { id: 'r12', author: 'Brian Eno Jr.', rating: 5, date: '3 weeks ago', comment: 'Incredible range of sounds. Perfect for live performance.' },
        ],
    },

    // ─── WIND INSTRUMENTS ─────────────────────────────────────────────────────
    {
        name: 'Selmer Paris Series III Alto Saxophone',
        category: 'Wind Instruments',
        price: 4299,
        image: '/assets/product-horn.jpg',
        images: ['/assets/product-horn.jpg', '/assets/product-horn.jpg', '/assets/product-horn.jpg', '/assets/product-horn.jpg'],
        description: 'The pinnacle of saxophone craftsmanship. The Series III provides the preferred tonal quality of professional musicians worldwide.',
        rating: 5,
        reviews: 67,
        brand: 'Selmer',
        condition: 'New',
        skillLevel: 'Professional',
        inStock: true,
        stockCount: 4,
        specifications: [
            { label: 'Key', value: 'E-flat' },
            { label: 'Material', value: 'Lacquered Brass' },
            { label: 'Keys', value: 'High F# + Front F' },
            { label: 'Neck', value: 'Silver-plated' },
            { label: 'Finish', value: 'Gold lacquer' },
            { label: 'Case', value: 'Contoured case included' },
        ],
        customerReviews: [
            { id: 'r13', author: 'John Coltrane Jr.', rating: 5, date: '1 month ago', comment: 'Heirloom quality. The projection and intonation are unmatched.' },
        ],
    },
    {
        name: 'Yamaha YFL-222 Student Flute',
        category: 'Wind Instruments',
        price: 349,
        image: '/assets/product-horn.jpg',
        images: ['/assets/product-horn.jpg', '/assets/product-horn.jpg', '/assets/product-horn.jpg', '/assets/product-horn.jpg'],
        description: 'The ideal beginner flute with a drawn tone hole design and cupronickel tubes for balanced, responsive playability.',
        rating: 4,
        reviews: 243,
        brand: 'Yamaha',
        condition: 'New',
        skillLevel: 'Beginner',
        inStock: true,
        stockCount: 28,
        specifications: [
            { label: 'Body', value: 'Cupronickel' },
            { label: 'Head Joint', value: 'Silver-plated' },
            { label: 'Tone Holes', value: 'Drawn, closed' },
            { label: 'Keys', value: 'Offset G, split E' },
            { label: 'Finish', value: 'Silver-plated' },
            { label: 'Case', value: 'Lightweight case included' },
        ],
        customerReviews: [
            { id: 'r14', author: 'Lizzo Jr.', rating: 4, date: '1 week ago', comment: 'Perfect for school orchestra. Excellent intonation for the price.' },
        ],
    },

    // ─── STRING INSTRUMENTS ───────────────────────────────────────────────────
    {
        name: 'Yamaha Silent Violin SV-255',
        category: 'String Instruments',
        price: 899,
        image: '/assets/product-bass.jpg',
        images: ['/assets/product-bass.jpg', '/assets/product-bass.jpg', '/assets/product-bass.jpg', '/assets/product-bass.jpg'],
        description: 'Practice anywhere without disturbing others. The SV-255 features a built-in reverb and chorus effects system with headphone output.',
        rating: 5,
        reviews: 88,
        brand: 'Yamaha',
        condition: 'New',
        skillLevel: 'Intermediate',
        inStock: true,
        stockCount: 14,
        specifications: [
            { label: 'Type', value: 'Electric Silent Violin' },
            { label: 'Strings', value: '4-string' },
            { label: 'Body', value: 'Carbon fiber composite' },
            { label: 'Effects', value: 'Reverb + Chorus onboard' },
            { label: 'Output', value: 'Headphone + Line Out' },
            { label: 'Includes', value: 'Bow, Rosin, Case' },
        ],
        customerReviews: [
            { id: 'r15', author: 'Hilary Hahn Jr.', rating: 5, date: '2 weeks ago', comment: 'The built-in effects are fantastic. Great for apartment practice.' },
        ],
    },
    {
        name: 'Cello 4/4 Stentor Student II',
        category: 'String Instruments',
        price: 549,
        originalPrice: 649,
        onSale: true,
        image: '/assets/product-bass.jpg',
        images: ['/assets/product-bass.jpg', '/assets/product-bass.jpg', '/assets/product-bass.jpg', '/assets/product-bass.jpg'],
        description: 'The Stentor Student II cello is crafted for young students and adult beginners with a solid spruce top and tonewoods for beautiful classical resonance.',
        rating: 4,
        reviews: 112,
        brand: 'Stentor',
        condition: 'New',
        skillLevel: 'Beginner',
        inStock: true,
        stockCount: 16,
        specifications: [
            { label: 'Size', value: '4/4 Full Size' },
            { label: 'Top', value: 'Solid Spruce' },
            { label: 'Back/Sides', value: 'Maple' },
            { label: 'Fingerboard', value: 'Ebony' },
            { label: 'Strings', value: 'Perlon-core' },
            { label: 'Includes', value: 'Bow, Rosin, Case' },
        ],
        customerReviews: [
            { id: 'r16', author: 'Yo-Yo Ma Jr.', rating: 4, date: '3 weeks ago', comment: 'Excellent beginner cello. Warm tone and easy to play.' },
        ],
    },

    // ─── DJ & ELECTRONICS ─────────────────────────────────────────────────────
    {
        name: 'Pioneer DJ DDJ-REV7',
        category: 'DJ & Electronics',
        price: 1299,
        image: '/assets/product-headphones.jpg',
        images: ['/assets/product-headphones.jpg', '/assets/product-headphones.jpg', '/assets/product-headphones.jpg', '/assets/product-headphones.jpg'],
        description: 'A 2-channel professional DJ controller built for Serato DJ Pro, mirroring the layout of a club setup with motorized jogwheels and onboard effects.',
        rating: 5,
        reviews: 145,
        brand: 'Pioneer DJ',
        condition: 'New',
        skillLevel: 'Professional',
        inStock: true,
        stockCount: 6,
        specifications: [
            { label: 'Channels', value: '2-channel' },
            { label: 'Jogwheels', value: '7" Motorized' },
            { label: 'Software', value: 'Serato DJ Pro' },
            { label: 'Outputs', value: 'Master RCA + XLR, Booth RCA' },
            { label: 'Connectivity', value: 'USB-B' },
            { label: 'FX', value: 'Onboard Beat FX + Sound Color FX' },
        ],
        customerReviews: [
            { id: 'r17', author: 'Tiesto Jr.', rating: 5, date: '2 weeks ago', comment: 'The motorized platters feel exactly like vinyl. Incredible for scratching.' },
        ],
    },
    {
        name: 'Numark Mixtrack Pro FX',
        category: 'DJ & Electronics',
        price: 249,
        image: '/assets/product-headphones.jpg',
        images: ['/assets/product-headphones.jpg', '/assets/product-headphones.jpg', '/assets/product-headphones.jpg', '/assets/product-headphones.jpg'],
        description: 'The ideal DJ controller for beginners. Includes Serato DJ Lite software and an intuitive layout to start mixing right away.',
        rating: 4,
        reviews: 321,
        brand: 'Numark',
        condition: 'New',
        skillLevel: 'Beginner',
        inStock: true,
        stockCount: 40,
        specifications: [
            { label: 'Channels', value: '2-channel' },
            { label: 'Jogwheels', value: '6" Non-motorized' },
            { label: 'Software', value: 'Serato DJ Lite (included)' },
            { label: 'Outputs', value: 'Master RCA, Headphone' },
            { label: 'FX Paddles', value: '4 per deck' },
            { label: 'Power', value: 'USB-powered' },
        ],
        customerReviews: [
            { id: 'r18', author: 'Martin Garrix Jr.', rating: 4, date: '1 month ago', comment: 'Perfect starter controller. Had me mixing within an hour.' },
        ],
    },

    // ─── STUDIO & RECORDING ───────────────────────────────────────────────────
    {
        name: 'Shure SM7dB Active Dynamic Microphone',
        category: 'Studio & Recording',
        price: 499,
        image: '/assets/product-headphones.jpg',
        images: ['/assets/product-headphones.jpg', '/assets/product-headphones.jpg', '/assets/product-headphones.jpg', '/assets/product-headphones.jpg'],
        description: 'The SM7dB is the iconic SM7B with a built-in preamp, providing a clean 28dB of gain ideal for podcasting, broadcasting, and vocal recording.',
        rating: 5,
        reviews: 267,
        brand: 'Shure',
        condition: 'New',
        skillLevel: 'Professional',
        inStock: true,
        stockCount: 22,
        specifications: [
            { label: 'Type', value: 'Active Dynamic' },
            { label: 'Pattern', value: 'Cardioid' },
            { label: 'Frequency Response', value: '50Hz – 20kHz' },
            { label: 'Built-in Preamp', value: '+28dB switchable' },
            { label: 'Connection', value: 'XLR' },
            { label: 'Includes', value: 'Yoke mount, windscreen, pop filter' },
        ],
        customerReviews: [
            { id: 'r19', author: 'Joe Rogan Jr.', rating: 5, date: '2 weeks ago', comment: 'The built-in preamp is a game changer. Crystal clear recordings every time.' },
        ],
    },
    {
        name: 'Focusrite Scarlett 2i2 (4th Gen)',
        category: 'Studio & Recording',
        price: 179,
        image: '/assets/product-headphones.jpg',
        images: ['/assets/product-headphones.jpg', '/assets/product-headphones.jpg', '/assets/product-headphones.jpg', '/assets/product-headphones.jpg'],
        description: 'The world\'s best-selling audio interface. The 4th gen Scarlett 2i2 features enhanced Air mode preamps and improved A/D conversion for pristine recordings.',
        rating: 5,
        reviews: 1842,
        brand: 'Focusrite',
        condition: 'New',
        skillLevel: 'Beginner',
        inStock: true,
        stockCount: 60,
        specifications: [
            { label: 'Inputs', value: '2x XLR/TRS Combo' },
            { label: 'Outputs', value: '2x TRS, 1x Headphone' },
            { label: 'Sample Rate', value: 'Up to 192kHz/24-bit' },
            { label: 'Preamps', value: 'Scarlett 4th Gen (Air mode)' },
            { label: 'Phantom Power', value: '+48V' },
            { label: 'Connectivity', value: 'USB-C' },
        ],
        customerReviews: [
            { id: 'r20', author: 'Billie Eilish Jr.', rating: 5, date: '1 month ago', comment: 'Perfect starter interface. Plug-and-play and sounds incredible.' },
        ],
    },
    {
        name: 'Sony MDR-7506 Studio Headphones',
        category: 'Studio & Recording',
        price: 99,
        image: '/assets/product-headphones.jpg',
        images: ['/assets/product-headphones.jpg', '/assets/product-headphones.jpg', '/assets/product-headphones.jpg', '/assets/product-headphones.jpg'],
        description: 'The industry-standard closed-back headphone used in studios around the world for over 30 years. Detailed, accurate monitoring with deep bass extension.',
        rating: 5,
        reviews: 3201,
        brand: 'Sony',
        condition: 'New',
        skillLevel: 'Intermediate',
        inStock: true,
        stockCount: 75,
        specifications: [
            { label: 'Driver', value: '40mm Dynamic' },
            { label: 'Frequency Response', value: '10Hz – 20kHz' },
            { label: 'Impedance', value: '63 Ohms' },
            { label: 'Sensitivity', value: '106dB' },
            { label: 'Cable', value: '9.8ft coiled' },
            { label: 'Connector', value: '3.5mm with 6.35mm adapter' },
        ],
        customerReviews: [
            { id: 'r21', author: 'Rick Rubin Jr.', rating: 5, date: '3 weeks ago', comment: 'An absolute studio staple. Every recording engineer owns at least one pair.' },
        ],
    },

    // ─── ACCESSORIES ──────────────────────────────────────────────────────────
    {
        name: 'Ernie Ball Regular Slinky Guitar Strings (6-Pack)',
        category: 'Accessories',
        price: 39,
        image: '/assets/product-bass.jpg',
        images: ['/assets/product-bass.jpg', '/assets/product-bass.jpg', '/assets/product-bass.jpg', '/assets/product-bass.jpg'],
        description: 'The most popular electric guitar strings in the world. Regular Slinkys feature a nickel wound design for smooth feel and bright, balanced tone.',
        rating: 5,
        reviews: 4892,
        brand: 'Ernie Ball',
        condition: 'New',
        skillLevel: 'Beginner',
        inStock: true,
        stockCount: 200,
        specifications: [
            { label: 'Gauges', value: '.010, .013, .017, .026, .036, .046' },
            { label: 'Material', value: 'Nickel Wound' },
            { label: 'Pack Count', value: '6 sets' },
            { label: 'Suitable For', value: 'Electric Guitar' },
            { label: 'Plain Strings', value: 'Tin-plated carbon steel' },
            { label: 'Wound Strings', value: 'Nickel-plated steel on hex core' },
        ],
        customerReviews: [
            { id: 'r22', author: 'Jimi Hendrix Jr.', rating: 5, date: '2 days ago', comment: 'The only strings I will ever use. Consistent quality every time.' },
        ],
    },
    {
        name: 'Roland BC-15M Portable Keyboard Amplifier',
        category: 'Accessories',
        price: 299,
        originalPrice: 349,
        onSale: true,
        image: '/assets/product-headphones.jpg',
        images: ['/assets/product-headphones.jpg', '/assets/product-headphones.jpg', '/assets/product-headphones.jpg', '/assets/product-headphones.jpg'],
        description: 'A powerful 15W stereo keyboard amplifier with built-in chorus and reverb effects, perfect for practice, rehearsal, and small venues.',
        rating: 4,
        reviews: 97,
        brand: 'Roland',
        condition: 'New',
        skillLevel: 'Intermediate',
        inStock: true,
        stockCount: 13,
        specifications: [
            { label: 'Power', value: '15W + 15W Stereo' },
            { label: 'Speakers', value: '2x 6.5"' },
            { label: 'Inputs', value: '2x Stereo TRS + Stereo Aux' },
            { label: 'Effects', value: 'Chorus + Reverb' },
            { label: 'Output', value: 'Headphone, XLR (mono)' },
            { label: 'Weight', value: '6.5kg' },
        ],
        customerReviews: [
            { id: 'r23', author: 'Elton John Jr.', rating: 4, date: '1 month ago', comment: 'Clear, loud, and portable. My go-to amp for rehearsals.' },
        ],
    },
];

const importData = async () => {
    try {
        await Product.deleteMany();
        await Order.deleteMany();

        // Drop the stale "id_1" unique index if it exists.
        // This index was created by an older schema where "id" was an explicit
        // unique field. Now "id" is a Mongoose virtual (alias for _id), so the
        // old index must be removed before bulk-inserting new documents.
        try {
            await Product.collection.dropIndex('id_1');
            console.log('ℹ️  Dropped stale id_1 index');
        } catch (_) {
            // Index doesn't exist — nothing to do
        }

        await Product.insertMany(mockProducts);

        console.log('✅ Musical Instrument Data Imported!');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

const destroyData = async () => {
    try {
        await Product.deleteMany();
        await Order.deleteMany();

        console.log('🗑️  Data Destroyed!');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

if (process.argv[2] === '-d') {
    destroyData();
} else {
    importData();
}
