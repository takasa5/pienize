var imgUpload = new Vue({
    el: ".editArea",
    data: {
        uploadedImage: null,
        imageLoadedFlag: false,
        faceDetectedFlag: false,
        faces: undefined,
        fileName: undefined,
        drawedSize: undefined,
        loadingFlag: true,
        loadMessage: "顔検出モデルを読み込んでいます...",
    },
    methods: {
        // ファイルアップロード時に実行されるメソッド
        onFileChange: function(e) {
            let files = e.target.files || e.dataTransfer.files;
            this.fileName = files[0].name;
            this.loadMessage = "画像を読み込み中です...";
            this.loadingFlag = true;
            this.createImage(files[0]);
        },
        // アップロードした画像を表示
        createImage: function(file) {
            let reader = new FileReader();
            reader.onload = (e) => {
                this.uploadedImage = e.target.result;
                this.drawOnCanvas(this.uploadedImage);
                // 不要になった要素を消す
                this.imageLoadedFlag = true;
            };
            reader.readAsDataURL(file);
        },
        // canvas上に表示するための操作
        drawOnCanvas: function(result) {
            // drawImageにはimgタグを入れる必要がある
            var img = new Image();
            // canvas = document.getElementById("canvas");
            canvas = this.$refs.canvas;
            img.src = result;
            img.onload = async (e) => {
                // 画像全体をcanvas中央に配置
                var ow = img.naturalWidth;
                var oh = img.naturalHeight;
                
                var nw, nh, dx, dy;
                if (ow > oh) {
                    nw = canvas.clientWidth;
                    nh = oh * (nw / ow);
                    dx = 0;
                    dy = canvas.clientHeight / 2 - nh / 2;
                } else {
                    nh = canvas.clientHeight;
                    nw = ow * (nh / oh);
                    dx = canvas.clientWidth / 2 - nw / 2;
                    dy = 0;
                }
                this.drawedSize = {
                    dx: dx,
                    dy: dy,
                    width: nw,
                    height: nh
                }
                ctx = this.setupCanvas(canvas);
                ctx.drawImage(img, 0, 0, ow, oh, dx, dy, nw, nh);
                
                await this.detectFace(canvas);
                if (!this.faceDetectedFlag) {
                    UIkit.notification("顔の検出に失敗しました。別の画像をお試しください。", {
                        timeout: 2000
                    });
                    this.eraseCanvas([
                        this.$refs.canvas,
                        this.$refs.overlay
                    ]);
                    this.imageLoadedFlag = false;
                    
                } else {
                }
            }
        },
        // 高解像度なcanvasのためのメソッド
        setupCanvas: function (canvas) {
            // Get the device pixel ratio, falling back to 1.
            var dpr = window.devicePixelRatio || 1;
            // Get the size of the canvas in CSS pixels.
            var rect = canvas.getBoundingClientRect();
            // Give the canvas pixel dimensions of their CSS
            // size * the device pixel ratio.
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            var ctx = canvas.getContext('2d');
            // Scale all drawing operations by the dpr, so you
            // don't have to worry about the difference.
            ctx.scale(dpr, dpr);
            return ctx;
        },
        detectFace: async function (canvas) {
            this.loadMessage = "顔検出を実行中です...";
            this.loadingFlag = true;
            const displaySize = {width: canvas.width, height: canvas.height};
            const overlay = this.$refs.overlay;
            faceapi.matchDimensions(overlay, displaySize);
            const detections = await faceapi.detectAllFaces(canvas).withFaceLandmarks();
            console.log(detections);
            this.faceDetectedFlag = detections.length != 0;
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            this.faces = resizedDetections;
            this.loadingFlag = false;
            // faceapi.draw.drawDetections(overlay, resizedDetections);
            // faceapi.draw.drawFaceLandmarks(overlay, resizedDetections);
        },
        eraseCanvas: function (canvases) {
            if (!Array.isArray(canvases)) {
                canvases = [canvases];
            }
            for (canvas of canvases) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        },
        drawPien: function() {
            const faces = this.faces;
            const overlay = this.$refs.overlay;
            const ctx = overlay.getContext('2d');
            // 画像読み込み
            const img = new Image();
            img.src = "./img/apple.png";
            img.onload = (e) => {
                // 描画
                for (const face of faces) {
                    const angle = - this.calcFaceAngle(face);
                    const centerX = face.detection.box.x + face.detection.box.width / 2;
                    const centerY = face.detection.box.y + face.detection.box.height / 2;
                    this.drawRotate(ctx, img, face.detection.box, centerX, centerY, angle);
                }
            }
        },
        pienMask: function() {
            this.drawPien();
        },
        calcFaceAngle: function(face) {
            const startX = face.landmarks.positions[27].x;
            const startY = face.landmarks.positions[27].y;
            const endX = face.landmarks.positions[30].x;
            const endY = face.landmarks.positions[30].y;
            const vecX = endX - startX;
            const vecY = endY - startY;
            return Math.atan2(vecX, vecY);
        },
        drawRotate: function(ctx, img, size, x, y, angle) {
            // x,y: 描画する画像の中心
            // size: 描画サイズ
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.drawImage(
                img, 0, 0, img.naturalWidth, img.naturalHeight,
                -(size.width / 2), -(size.height / 2),
                size.width, size.height
            );
            ctx.restore();
        },
        changeFile: function() {
            const upload = document.getElementById("fileUpload");
            upload.click();
        },
        concatCanvas: async function() {
            const canvas = document.createElement("canvas");
            var dpr = window.devicePixelRatio || 1;
            canvas.width = this.drawedSize.width * dpr;
            canvas.height = this.drawedSize.height * dpr;
            const ctx = canvas.getContext("2d");
            for (const cvs of [this.$refs.canvas, this.$refs.overlay]) {
                const img = await this.getImageFromCanvas(cvs);
                ctx.drawImage(img,
                    this.drawedSize.dx * dpr, this.drawedSize.dy * dpr,
                    this.drawedSize.width * dpr, this.drawedSize.height * dpr,
                    0, 0,
                    canvas.width, canvas.height
                );
            }
            return canvas;
        },
        getImageFromCanvas: function(canvas) {
            return new Promise((resolve, reject) => {
                const image = new Image();
                const ctx = canvas.getContext("2d");
                image.onload = () => resolve(image);
                image.onerror = (e) => reject(e);
                image.src = ctx.canvas.toDataURL();
            });
        },
        downloadCanvas: async function() {
            const canvas = await this.concatCanvas();
            let link = document.createElement("a");
            link.href = canvas.toDataURL("image/png");
            link.download = `pienized_${this.fileName}.png`;
            link.click();
        }
    },
    mounted: async function() {
        console.log("a");
        this.loadMessage = "顔検出モデルを読み込んでいます...";
        await faceapi.nets.ssdMobilenetv1.loadFromUri('models/');
        await faceapi.nets.faceLandmark68Net.loadFromUri('models/');
        this.loadingFlag = false;
        console.log("end");
    }
});
