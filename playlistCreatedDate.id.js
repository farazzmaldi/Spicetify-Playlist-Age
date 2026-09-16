(function PlaylistCreatedDate() {
    const ELEMENT_ID = "playlist-created-date-spicetify";

    function waitForSpotify() {
        if (
            !window.Spicetify ||
            !Spicetify.Platform?.History ||
            !Spicetify.Platform?.PlaylistAPI?.getPlaylist
        ) {
            setTimeout(waitForSpotify, 300);
            return;
        }

        init();
    }

    function getPlaylistURI() {
        const path =
            Spicetify.Platform.History.location?.pathname ||
            location.pathname;

        const match = path.match(/\/playlist\/([A-Za-z0-9]+)/);

        if (!match) return null;

        return `spotify:playlist:${match[1]}`;
    }

    function removeOld() {
        document.getElementById(ELEMENT_ID)?.remove();
    }

    function formatDate(date) {
        return new Intl.DateTimeFormat("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric"
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
