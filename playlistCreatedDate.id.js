/**
 * Spicetify Playlist Age
 * Indonesian Version
 * Version: 1.0.0
 *
 * Menampilkan perkiraan tanggal pembuatan playlist dan usia kalender
 * berdasarkan timestamp item playlist tertua yang masih tersedia.
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

    /*
     * Mencegah extension termuat dua kali.
     * English dan Indonesian menggunakan flag yang sama,
     * sehingga keduanya tidak boleh diaktifkan bersamaan.
     */
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
        return new Intl.DateTimeFormat("id-ID", {
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

    /*
     * Menambahkan tahun dengan aman.
     *
     * Contoh:
     * 29 Februari 2024 + 1 tahun
     * menjadi 28 Februari 2025.
     */
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

    /*
     * Menambahkan bulan dengan aman.
     *
     * Contoh:
     * 31 Januari + 1 bulan
     * akan menyesuaikan ke hari terakhir Februari.
     */
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

    /*
     * Menggunakan UTC untuk menghitung selisih hari
     * agar tidak terganggu DST atau perubahan offset waktu.
     */
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

    function getPlaylistAge(date) {
        const created =
            localDateOnly(date);

        const today =
            localDateOnly(new Date());

        if (created.getTime() === today.getTime()) {
            return "hari ini";
        }

        if (created > today) {
            return "tanggal di masa depan";
        }

        /*
         * Hitung tahun kalender penuh.
         */
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

        /*
         * Hitung bulan kalender penuh setelah tahun.
         */
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

        /*
         * Sisa umur dihitung sebagai hari kalender.
         */
        const days =
            differenceInCalendarDays(
                monthAnchor,
                today
            );

        const parts = [];

        if (years > 0) {
            parts.push(
                `${years} tahun`
            );
        }

        if (months > 0) {
            parts.push(
                `${months} bulan`
            );
        }

        if (days > 0) {
            parts.push(
                `${days} hari`
            );
        }

        if (!parts.length) {
            return "hari ini";
        }

        return `${parts.join(", ")} yang lalu`;
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

        /*
         * Beberapa timestamp dapat menggunakan detik,
         * sementara JavaScript Date menggunakan milidetik.
         */
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
                "Tidak ditemukan item playlist yang dapat dibaca."
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
                "Timestamp addedAt yang dapat digunakan tidak ditemukan."
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

    /*
     * Menunggu heading playlist muncul menggunakan
     * MutationObserver, bukan polling terus-menerus.
     */
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

        /*
         * Abaikan render lama apabila user sudah
         * berpindah ke playlist lain.
         */
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

            /*
             * Pastikan data yang selesai dimuat masih
             * berasal dari playlist yang sedang dibuka.
             */
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
                    "Perkiraan berdasarkan timestamp item",
                    "tertua yang masih tersedia di playlist.",
                    `${result.datesFound} dari`,
                    `${result.itemCount} item memiliki`,
                    "metadata tanggal yang dapat digunakan."
                ].join(" "),
                generation
            );

        } catch (error) {
            console.warn(
                `[Spicetify Playlist Age ID v${VERSION}]`,
                error
            );

            if (
                generation !== renderGeneration
            ) {
                return;
            }

            await insertDate(
                "Tanggal playlist tidak tersedia",
                error?.message ||
                    String(error),
                generation
            );
        }
    }

    /*
     * Usia playlist berubah berdasarkan tanggal kalender.
     * Refresh otomatis beberapa detik setelah tengah malam.
     */
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
})();            year: "numeric"
        }).format(date);
    }

    function getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    function getPlaylistAge(date) {
        const now = new Date();

        const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );

        const created = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        );

        if (created > today) {
            return "tanggal di masa depan";
        }

        if (created.getTime() === today.getTime()) {
            return "hari ini";
        }

        let years =
            today.getFullYear() -
            created.getFullYear();

        let months =
            today.getMonth() -
            created.getMonth();

        let days =
            today.getDate() -
            created.getDate();

        /*
         * Jika jumlah hari negatif,
         * pinjam hari dari bulan sebelumnya.
         */
        if (days < 0) {
            months--;

            const previousMonth =
                today.getMonth() - 1;

            let previousMonthYear =
                today.getFullYear();

            let normalizedMonth =
                previousMonth;

            if (normalizedMonth < 0) {
                normalizedMonth = 11;
                previousMonthYear--;
            }

            days += getDaysInMonth(
                previousMonthYear,
                normalizedMonth
            );
        }

        /*
         * Jika jumlah bulan negatif,
         * pinjam satu tahun.
         */
        if (months < 0) {
            years--;
            months += 12;
        }

        const parts = [];

        if (years > 0) {
            parts.push(
                `${years} tahun`
            );
        }

        if (months > 0) {
            parts.push(
                `${months} bulan`
            );
        }

        if (days > 0) {
            parts.push(
                `${days} hari`
            );
        }

        if (!parts.length) {
            return "hari ini";
        }

        return `${parts.join(", ")} yang lalu`;
    }

    function parseDate(value) {
        if (!value) return null;

        let date;

        /*
         * Antisipasi Unix timestamp dalam detik.
         */
        if (
            typeof value === "number" &&
            value > 0 &&
            value < 100000000000
        ) {
            date = new Date(value * 1000);
        } else {
            date = new Date(value);
        }

        if (Number.isNaN(date.getTime())) {
            return null;
        }

        return date;
    }

    async function getOldestDate(uri) {
        console.log(
            "[Playlist Created Date] Membaca:",
            uri
        );

        const playlist =
            await Spicetify.Platform.PlaylistAPI.getPlaylist(uri);

        console.log(
            "[Playlist Created Date] Playlist:",
            playlist
        );

        const items =
            playlist?.contents?.items || [];

        console.log(
            "[Playlist Created Date] Jumlah item:",
            items.length
        );

        if (!items.length) {
            throw new Error(
                "Playlist kosong atau item tidak dapat dibaca."
            );
        }

        console.log(
            "[Playlist Created Date] Contoh item:",
            items[0]
        );

        const dates = [];

        for (const item of items) {
            const raw =
                item?.addedAt ??
                item?.added_at ??
                item?.addedTime ??
                item?.added_time ??
                null;

            const parsed =
                parseDate(raw);

            if (parsed) {
                dates.push(parsed);
            }
        }

        if (!dates.length) {
            throw new Error(
                "Playlist terbaca, tetapi tanggal addedAt tidak ditemukan."
            );
        }

        dates.sort(
            (a, b) =>
                a.getTime() - b.getTime()
        );

        return {
            date: dates[0],
            total: items.length,
            datesFound: dates.length
        };
    }

    function insert(text, tooltip = "") {
        removeOld();

        let tries = 0;

        const timer =
            setInterval(() => {

                tries++;

                const h1 =
                    document.querySelector("main h1");

                if (!h1) {
                    if (tries > 50) {
                        clearInterval(timer);
                    }

                    return;
                }

                clearInterval(timer);

                removeOld();

                const el =
                    document.createElement("div");

                el.id =
                    ELEMENT_ID;

                el.textContent =
                    text;

                if (tooltip) {
                    el.title =
                        tooltip;
                }

                Object.assign(
                    el.style,
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

                h1.insertAdjacentElement(
                    "afterend",
                    el
                );

            }, 150);
    }

    async function render() {
        removeOld();

        const uri =
            getPlaylistURI();

        if (!uri) {
            return;
        }

        try {
            const result =
                await getOldestDate(uri);

            const formattedDate =
                formatDate(result.date);

            const age =
                getPlaylistAge(result.date);

            insert(
                `${formattedDate} (${age})`,
                `Perkiraan berdasarkan item tertua yang masih ada di playlist. ${result.datesFound} dari ${result.total} item memiliki data tanggal.`
            );

            console.log(
                "[Playlist Created Date] BERHASIL:",
                formattedDate,
                age
            );

        } catch (error) {
            console.error(
                "[Playlist Created Date] ERROR:",
                error
            );

            insert(
                "Tanggal playlist tidak tersedia",
                error?.message ||
                String(error)
            );
        }
    }

    function init() {
        console.log(
            "[Playlist Created Date] v6 precise age loaded"
        );

        Spicetify.Platform.History.listen(
            () => {
                setTimeout(
                    render,
                    500
                );
            }
        );

        setTimeout(
            render,
            800
        );
    }

    waitForSpotify();
})();
