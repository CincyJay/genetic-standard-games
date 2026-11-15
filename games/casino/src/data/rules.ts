/**
 * Full rules for the table games, shown in the Rules sheet (ui/rules.ts). Every
 * number here must match the game logic in src/logic; tests/rules.test.ts checks
 * the pay tables against it.
 */
export interface RulesSection {
  head: string;
  lines: string[];
}
export interface GameRules {
  title: string;
  intro: string;
  sections: RulesSection[];
}

export type RulesKey = 'blackjack' | 'roulette' | 'baccarat' | 'threecard' | 'craps' | 'uth' | 'war';

export const RULES: Record<RulesKey, GameRules> = {
  blackjack: {
    title: 'Blackjack',
    intro: 'Beat the dealer by getting closer to 21 without going over.',
    sections: [
      {
        head: 'The game',
        lines: [
          'Six decks, shuffled when the shoe runs low.',
          'Number cards count their value, pictures count 10, and an ace counts 1 or 11.',
          'Play up to 3 hands at once.',
          'Blackjack (an ace and a ten-value card as your first two cards) pays 3 to 2.',
          'Other wins pay 1 to 1; a tie is a push and your bet comes back.',
        ],
      },
      {
        head: 'Your choices',
        lines: [
          'Hit: take another card. Stand: keep your total.',
          'Double: double your bet on your first two cards and take exactly one more card.',
          'Split: split a pair into two hands, once per hand. Split aces get one card each.',
        ],
      },
      {
        head: 'The dealer',
        lines: ['The dealer stands on all 17s, including soft 17.', 'The dealer checks for blackjack before you play.'],
      },
      {
        head: 'Side bets (optional, per hand)',
        lines: [
          '21+3: your two cards and the dealer’s up card as a three-card poker hand. Suited three of a kind 100 to 1, straight flush 40 to 1, three of a kind 30 to 1, straight 10 to 1, flush 5 to 1.',
          'Perfect Pairs: your first two cards. Perfect pair (same suit) 25 to 1, coloured pair (same colour) 12 to 1, mixed pair 6 to 1.',
        ],
      },
    ],
  },
  roulette: {
    title: 'Roulette',
    intro: 'European single-zero roulette: 37 pockets, 0 to 36.',
    sections: [
      {
        head: 'Inside bets',
        lines: ['Straight (one number) 35 to 1', 'Split (two numbers) 17 to 1', 'Street (three numbers) 11 to 1', 'Corner (four numbers) 8 to 1', 'Six line (six numbers) 5 to 1'],
      },
      {
        head: 'Outside bets',
        lines: ['Dozen or column 2 to 1', 'Red or black, odd or even, 1–18 or 19–36: 1 to 1', 'Zero loses every outside bet.'],
      },
      {
        head: 'Racetrack',
        lines: ['Called bets (such as neighbours of a number) place one chip on each number they cover.'],
      },
    ],
  },
  baccarat: {
    title: 'Baccarat',
    intro: 'Bet on the hand that finishes closer to 9: Player or Banker. Eight decks.',
    sections: [
      {
        head: 'Card values',
        lines: ['Ace counts 1, 2 to 9 count their value, tens and pictures count 0.', 'A hand’s total is the last digit of the sum (7 + 8 = 15 counts 5).'],
      },
      {
        head: 'Drawing',
        lines: [
          'A natural (8 or 9 on the first two cards) stands.',
          'Otherwise the Player draws a third card on 0 to 5.',
          'The Banker follows the standard third-card table. The game draws for you.',
        ],
      },
      {
        head: 'Pays',
        lines: ['Player 1 to 1', 'Banker 0.95 to 1 (a 5% commission)', 'Tie 8 to 1', 'Player Pair or Banker Pair 11 to 1'],
      },
    ],
  },
  threecard: {
    title: 'Three Card Poker',
    intro: 'Make a better three-card hand than the dealer.',
    sections: [
      {
        head: 'How a hand plays',
        lines: [
          'Place an Ante (and Pair Plus if you like), then see your three cards.',
          'Play (bet the same as your Ante) or Fold (lose the Ante).',
          'The dealer needs queen high or better to play.',
          'If the dealer doesn’t qualify: the Ante pays 1 to 1 and the Play bet comes back.',
          'If the dealer qualifies: beat the dealer and Ante and Play each pay 1 to 1; a tie pushes both.',
        ],
      },
      {
        head: 'Hand ranks, high to low',
        lines: ['Straight flush, three of a kind, straight, flush, pair, high card.', 'With three cards a straight beats a flush. Aces are high, or low in A-2-3.'],
      },
      {
        head: 'Ante bonus (paid even if the dealer wins)',
        lines: ['Straight flush 5 to 1', 'Three of a kind 4 to 1', 'Straight 1 to 1'],
      },
      {
        head: 'Pair Plus (your hand only)',
        lines: ['Straight flush 40 to 1', 'Three of a kind 30 to 1', 'Straight 6 to 1', 'Flush 4 to 1', 'Pair 1 to 1'],
      },
    ],
  },
  craps: {
    title: 'Craps',
    intro: 'Bet on the roll of two dice.',
    sections: [
      {
        head: 'Pass Line',
        lines: [
          'On the come-out roll, 7 or 11 wins and 2, 3 or 12 loses.',
          'Any other total becomes the point. Roll the point again before a 7 to win; a 7 first loses.',
          'Pays 1 to 1. Once a point is set you can add Odds behind it, which pay true odds (4 or 10: 2 to 1, 5 or 9: 3 to 2, 6 or 8: 6 to 5).',
        ],
      },
      {
        head: 'Don’t Pass',
        lines: ['The opposite of Pass: 2 or 3 wins on the come-out, 12 pushes, 7 or 11 loses. After a point, a 7 before the point wins. Pays 1 to 1.'],
      },
      {
        head: 'Place and Hardways',
        lines: [
          'Place 4 or 10: 9 to 5. Place 5 or 9: 7 to 5. Place 6 or 8: 7 to 6. Wins when the number rolls before a 7.',
          'Hard 4 or 10: 7 to 1. Hard 6 or 8: 9 to 1. Wins when the number rolls as a pair before a 7 or the easy way.',
          'Place and Hardway bets are off on the come-out roll.',
        ],
      },
      {
        head: 'One-roll bets',
        lines: ['Field: 3, 4, 9, 10 or 11 pay 1 to 1, 2 pays 2 to 1, 12 pays 3 to 1.', 'Any Seven 4 to 1. Any Craps (2, 3 or 12) 7 to 1. Yo (11) 15 to 1.'],
      },
    ],
  },
  uth: {
    title: "Ultimate Texas Hold'em",
    intro: 'Make the best five-card hand from your two cards and the five community cards, and beat the dealer.',
    sections: [
      {
        head: 'How a hand plays',
        lines: [
          'Place equal Ante and Blind bets (and Trips if you like).',
          'Before the flop: Play 4× or 3× your Ante, or check.',
          'After the flop: Play 2× or check. After the river: Play 1× or fold.',
          'You make only one Play bet per hand.',
        ],
      },
      {
        head: 'Settling',
        lines: [
          'The dealer needs a pair or better to open; if not, the Ante pushes.',
          'Beat the dealer and Play pays 1 to 1 (and Ante too if the dealer opened).',
          'The Blind pays only when you win with a straight or better, and pushes on other wins.',
          'A tie pushes every bet. If the dealer wins, Play and Blind lose (and Ante, if the dealer opened).',
          'Folding loses the Ante and Blind.',
        ],
      },
      {
        head: 'Blind pays',
        lines: ['Royal flush 500 to 1', 'Straight flush 50 to 1', 'Four of a kind 10 to 1', 'Full house 3 to 1', 'Flush 3 to 2', 'Straight 1 to 1'],
      },
      {
        head: 'Trips (your hand, whatever the dealer has)',
        lines: ['Royal flush 50 to 1', 'Straight flush 40 to 1', 'Four of a kind 30 to 1', 'Full house 8 to 1', 'Flush 7 to 1', 'Straight 4 to 1', 'Three of a kind 3 to 1'],
      },
    ],
  },
  war: {
    title: 'Casino War',
    intro: 'One card each; the higher card wins. Aces are high.',
    sections: [
      {
        head: 'How a hand plays',
        lines: ['Your card higher: win 1 to 1. Dealer’s card higher: you lose.', 'On a tie, choose to surrender (half your bet comes back) or go to war.'],
      },
      {
        head: 'Going to war',
        lines: [
          'Match your bet. The dealer burns three cards and deals one more card each.',
          'Win or tie the war: the raise wins 1 to 1 and the original bet pushes.',
          'Lose the war: both bets lose.',
        ],
      },
      {
        head: 'Tie bet (optional)',
        lines: ['Pays 10 to 1 if the first two cards tie.'],
      },
    ],
  },
};
