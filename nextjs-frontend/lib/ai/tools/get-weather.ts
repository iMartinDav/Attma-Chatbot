import { tool } from 'ai';
import { z } from 'zod/v4';

const weatherInputSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

type WeatherInput = z.infer<typeof weatherInputSchema>;

export const getWeather = tool({
  description: 'Get the current weather at a location',
  inputSchema: weatherInputSchema,
  execute: async (input: WeatherInput) => {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${input.latitude}&longitude=${input.longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`,
    );

    const weatherData = await response.json();
    return weatherData;
  },
});
