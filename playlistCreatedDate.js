/**
 * Spicetify Playlist Age
 * Version: 1.0.0
 *
 * Displays an estimated playlist creation date and its precise calendar age
 * using the oldest available playlist-item timestamp.
 *
 * Copyright (c) 2026 Farazzmaldi
 * Licensed under the MIT License.
 */

(function PlaylistCreatedDate() {
    "use strict";

    const VERSION = "1.0.0";
    const ELEMENT_ID = "spicetify-playlist-age";
    const GLOBAL_FLAG = "__spicetifyPlaylistAgeLoaded";

    let renderGeneration = 0;
    let midnightTimer = null;

    if (window[GLOBAL_FLAG]) {
        return;
    }

    window[GLOBAL_FLAG] = true;

    function waitForSpicetify() {
        if (
            !window.Spicetify ||
            !Spicetify.Platform?.History ||
            !Spicetify.Platform?.PlaylistAPI?.getPlaylist
        ) {
            setTimeout(waitForSpicetify, 300);
            return;
        }

        init();
    }

    function getPlaylistURI() {
        const pathname =
            Spicetify.Platform.History.location?.pathname ||
            window.location.pathname;

        const match =
            pathname.match(/\/playlist\/([A-Za-z0-9]+)/);

        return match
            ? `spotify:playlist:${match[1]}`
            : null;
    }

    function formatDate(date) {
        return new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric"
        }).format(date);
    }

    function localDateOnly(date) {
        return new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        );
    }

    function daysInMonth(year, month) {
        return new Date(
            year,
            month + 1,
            0
        ).getDate();
    }

    function addYearsClamped(date, years) {
        const year =
            date.getFullYear() + years;

        const month =
            date.getMonth();

        const day =
            Math.min(
                date.getDate(),
                daysInMonth(year, month)
            );

        return new Date(
            year,
            month,
            day
        );
    }

    function addMonthsClamped(date, months) {
        const totalMonths =
            date.getFullYear() * 12 +
            date.getMonth() +
            months;

        const year =
            Math.floor(totalMonths / 12);

        const month =
            ((totalMonths % 12) + 12) % 12;

        const day =
            Math.min(
                date.getDate(),
                daysInMonth(year, month)
            );

        return new Date(
            year,
            month,
            day
        );
    }

    function differenceInCalendarDays(start, end) {
        const startUTC =
            Date.UTC(
                start.getFullYear(),
                start.getMonth(),
                start.getDate()
            );

        const endUTC =
            Date.UTC(
                end.getFullYear(),
                end.getMonth(),
                end.getDate()
            );

        return Math.floor(
            (endUTC - startUTC) / 86400000
        );
    }

    function plural(value, singular, pluralForm) {
        return `${value} ${value === 1 ? singular : pluralForm}`;
    }

    function getPlaylistAge(date) {
        const created =
            localDateOnly(date);

        const today =
            localDateOnly(new Date());

        if (created.getTime() === today.getTime()) {
            return "today";
        }

        if (created > today) {
            return "future date";
        }

        let years =
            today.getFullYear() -
            created.getFullYear();

        let yearAnchor =
            addYearsClamped(
                created,
                years
            );

        if (yearAnchor > today) {
            years--;

            yearAnchor =
                addYearsClamped(
                    created,
                    years
                );
        }

        let months =
            (
                today.getFullYear() -
                yearAnchor.getFullYear()
            ) * 12 +
            (
                today.getMonth() -
                yearAnchor.getMonth()
            );

        let monthAnchor =
            addMonthsClamped(
                yearAnchor,
                months
            );

        if (monthAnchor > today) {
            months--;

            monthAnchor =
                addMonthsClamped(
                    yearAnchor,
                    months
                );
        }

        const days =
            differenceInCalendarDays(
                monthAnchor,
                today
            );

        const parts = [];

        if (years > 0) {
            parts.push(
                plural(
                    years,
                    "year",
                    "years"
                )
            );
        }

        if (months > 0) {
            parts.push(
                plural(
                    months,
                    "month",
                    "months"
                )
            );
        }

        if (days > 0) {
            parts.push(
                plural(
                    days,
                    "day",
                    "days"
                )
            );
        }

        if (!parts.length) {
            return "today";
        }

        return `${parts.join(", ")} ago`;
    }

    function parseDate(value) {
        if (!value) {
            return null;
        }

        if (value instanceof Date) {
            return Number.isNaN(value.getTime())
                ? null
                : value;
        }

        let date;

        if (typeof value === "number") {
            const timestamp =
                value < 100000000000
                    ? value * 1000
                    : value;

            date =
                new Date(timestamp);
        } else {
            date =
                new Date(value);
        }

        return Number.isNaN(date.getTime())
            ? null
            : date;
    }

    function getAddedDate(item) {
        const value =
            item?.addedAt ??
            item?.added_at ??
            item?.addedTime ??
            item?.added_time ??
            null;

        return parseDate(value);
    }

    async function getOldestAvailableDate(uri) {
        const playlist =
            await Spicetify.Platform.PlaylistAPI
                .getPlaylist(uri);

        const items =
            playlist?.contents?.items;

        if (
            !Array.isArray(items) ||
            items.length === 0
        ) {
            throw new Error(
                "No readable playlist items were found."
            );
        }

        let oldest = null;
        let datesFound = 0;

        for (const item of items) {
            const date =
                getAddedDate(item);

            if (!date) {
                continue;
            }

            datesFound++;

            if (
                !oldest ||
                date.getTime() < oldest.getTime()
            ) {
                oldest = date;
            }
        }

        if (!oldest) {
            throw new Error(
                "No usable addedAt timestamp was found."
            );
        }

        return {
            date: oldest,
            datesFound,
            itemCount: items.length
        };
    }

    function removeElement() {
        document
            .getElementById(ELEMENT_ID)
            ?.remove();
    }

    function findPlaylistHeading() {
        return (
            document.querySelector(
                '[data-testid="playlist-page"] h1'
            ) ||
            document.querySelector(
                "main h1"
            )
        );
    }

    function waitForPlaylistHeading(timeout = 8000) {
        return new Promise((resolve) => {
            const existing =
                findPlaylistHeading();

            if (existing) {
                resolve(existing);
                return;
            }

            const observer =
                new MutationObserver(() => {
                    const heading =
                        findPlaylistHeading();

                    if (!heading) {
                        return;
                    }

                    observer.disconnect();
                    clearTimeout(timer);
                    resolve(heading);
                });

            observer.observe(
                document.body,
                {
                    childList: true,
                    subtree: true
                }
            );

            const timer =
                setTimeout(() => {
                    observer.disconnect();
                    resolve(null);
                }, timeout);
        });
    }

    async function insertDate(
        text,
        tooltip,
        generation
    ) {
        const heading =
            await waitForPlaylistHeading();

        if (
            generation !== renderGeneration ||
            !heading
        ) {
            return;
        }

        removeElement();

        const element =
            document.createElement("div");

        element.id =
            ELEMENT_ID;

        element.textContent =
            text;

        element.title =
            tooltip;

        Object.assign(
            element.style,
            {
                fontSize: "13px",
                fontWeight: "400",
                opacity: "0.72",
                marginTop: "5px",
                marginBottom: "3px",
                lineHeight: "1.4",
                cursor: "default"
            }
        );

        heading.insertAdjacentElement(
            "afterend",
            element
        );
    }

    async function render() {
        const generation =
            ++renderGeneration;

        removeElement();

        const uri =
            getPlaylistURI();

        if (!uri) {
            return;
        }

        try {
            const result =
                await getOldestAvailableDate(uri);

            if (
                generation !== renderGeneration ||
                getPlaylistURI() !== uri
            ) {
                return;
            }

            const formattedDate =
                formatDate(result.date);

            const age =
                getPlaylistAge(result.date);

            await insertDate(
                `${formattedDate} (${age})`,
                [
                    "Estimated from the oldest available",
                    "playlist-item timestamp.",
                    `${result.datesFound} of`,
                    `${result.itemCount} items contained`,
                    "usable date metadata."
                ].join(" "),
                generation
            );

        } catch (error) {
            console.warn(
                `[Spicetify Playlist Age v${VERSION}]`,
                error
            );

            if (
                generation !== renderGeneration
            ) {
                return;
            }

            await insertDate(
                "Playlist date unavailable",
                error?.message ||
                    String(error),
                generation
            );
        }
    }

    function scheduleMidnightRefresh() {
        if (midnightTimer) {
            clearTimeout(midnightTimer);
        }

        const now =
            new Date();

        const nextMidnight =
            new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() + 1,
                0,
                0,
                2
            );

        midnightTimer =
            setTimeout(() => {
                render();
                scheduleMidnightRefresh();
            }, nextMidnight - now);
    }

    function init() {
        Spicetify.Platform.History.listen(
            () => {
                setTimeout(
                    render,
                    350
                );
            }
        );

        scheduleMidnightRefresh();

        setTimeout(
            render,
            500
        );
    }

    waitForSpicetify();
})();
