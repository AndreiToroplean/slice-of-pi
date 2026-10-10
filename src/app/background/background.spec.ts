import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { seasonAt } from '../seasons/seasons';
import { Background } from './background';

describe('Background', () => {
  it("starts on a new game's colors", () => {
    expect(TestBed.inject(Background).colors()).toEqual(seasonAt(0).background);
  });

  it("blends the browser's bars into the top of the background", async () => {
    const background = TestBed.inject(Background);

    background.colors.set(seasonAt(42).background);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(TestBed.inject(Meta).getTag('name="theme-color"')?.content).toBe(
      seasonAt(42).background[0],
    );
  });
});
