// Default promotions — used to seed the DB and as an offline fallback.
export const promotionsSeed = () => [
  {
    id: 'aperitivo-hour',
    title: 'Aperitivo Hour',
    description:
      'Every weekday from 5 – 7pm. Aperol spritzes, negronis, and our house Sicilian aperitivo plate at 25% off. Walk-in or call ahead to reserve a bar seat.',
    image: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=1000&q=80',
    startDate: '2026-05-01',
    endDate: '2026-07-31',
    url: ''
  },
  {
    id: 'sunday-brunch',
    title: 'Sunday Sicilian Brunch',
    description:
      'Every Sunday, 11am – 3pm. Wood-fired focaccia, frittatas, fresh tropical fruit, and bottomless mimosas at Rs. 4,500 per person. Kids under 10 dine free with two paying adults.',
    image: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=1000&q=80',
    startDate: '2026-05-15',
    endDate: '2026-08-31',
    url: ''
  },
  {
    id: 'fathers-day',
    title: "Father's Day Set Menu",
    description:
      "A four-course celebration menu for Father's Day weekend. Antipasto, hand-rolled pasta, your choice of main, and dessert at Rs. 7,800 per person. Booking essential — limited covers.",
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1000&q=80',
    startDate: '2026-06-19',
    endDate: '2026-06-21',
    url: ''
  }
]
