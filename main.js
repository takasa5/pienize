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
        pienFlag: false,
        pienMode: "apple",
        drawMode: undefined
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
            this.faceDetectedFlag = detections.length != 0;
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            this.faces = resizedDetections;
            this.loadingFlag = false;
            // console.log(detections);
            // faceapi.draw.drawDetections(overlay, resizedDetections);
            // faceapi.draw.drawFaceLandmarks(overlay, resizedDetections);
        },
        eraseCanvas: function (canvases) {
            this.pienFlag = false;
            if (!Array.isArray(canvases)) {
                canvases = [canvases];
            }
            for (canvas of canvases) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        },
        drawMask: function() {
            const faces = this.faces;
            const overlay = this.$refs.overlay;
            const ctx = overlay.getContext('2d');
            // 画像読み込み
            const img = new Image();
            img.src = `./img/${this.pienMode}.png`;
            img.onload = (e) => {
                // 描画
                for (const face of faces) {
                    const info = this.calcFaceInfo(face);
                    const angle = info.angle;
                    const centerX = info.center.x;
                    const centerY = info.center.y;
                    this.drawRotate(ctx, img, info.size, centerX, centerY, angle);
                }
            }
        },
        drawEyes: async function() {
            const faces = this.faces;
            const overlay = this.$refs.overlay;
            const ctx = overlay.getContext('2d');
            const [left, right] = await this.loadEyes();
            for (const face of faces) {
                const info = this.calcFaceInfo(face);
                this.drawRotate(ctx, left, info.eyes.left.size, info.eyes.left.x, info.eyes.left.y, info.angle);
                this.drawRotate(ctx, right, info.eyes.right.size, info.eyes.right.x, info.eyes.right.y, info.angle);
            }
        },
        pienMask: function() {
            this.eraseCanvas(this.$refs.overlay);
            this.pienFlag = true;
            this.drawMode = "mask";
            this.pienFlag = true;
            this.drawMask();
        },
        pienEyes: function() {
            this.eraseCanvas(this.$refs.overlay);
            this.pienFlag = true;
            this.drawMode = "eyes";
            this.pienFlag = true;
            this.drawEyes();
        },
        changePien: function(mode) {
            this.eraseCanvas(this.$refs.overlay);
            this.pienFlag = true;
            this.pienMode = mode;
            if (this.drawMode == "mask") {
                this.drawMask();
            } else if (this.drawMode == "eyes") {
                this.drawEyes();
            }
        },
        calcFaceInfo: function(face) {
            // 鼻のむき
            // const startX = face.landmarks.positions[27].x;
            // const startY = face.landmarks.positions[27].y;
            // const endX = face.landmarks.positions[30].x;
            // const endY = face.landmarks.positions[30].y;
            // const vecX = endX - startX;
            // const vecY = endY - startY;
            // return Math.atan2(vecX, vecY);
            const faceLeft = face.landmarks.positions[0];
            const faceRight = face.landmarks.positions[16];
            const faceBottom = face.landmarks.positions[8];
            const leftEyeWidth = Math.sqrt(
                Math.pow(face.landmarks.positions[36].x - face.landmarks.positions[39].x, 2)
                + Math.pow(face.landmarks.positions[36].y - face.landmarks.positions[39].y, 2)
                ) * 2;
            const rightEyeWidth = Math.sqrt(
                Math.pow(face.landmarks.positions[42].x - face.landmarks.positions[45].x, 2)
                + Math.pow(face.landmarks.positions[42].y - face.landmarks.positions[45].y, 2)
                ) * 2;
            const leftEye = {
                x: (face.landmarks.positions[36].x + face.landmarks.positions[39].x) / 2,
                y: (face.landmarks.positions[36].y + face.landmarks.positions[39].y) / 2,
                size: {
                    width: leftEyeWidth,
                    height: leftEyeWidth
                } 
            };
            const rightEye = {
                x: (face.landmarks.positions[42].x + face.landmarks.positions[45].x) / 2,
                y: (face.landmarks.positions[42].y + face.landmarks.positions[45].y) / 2,
                size: {
                    width: rightEyeWidth,
                    height: rightEyeWidth
                }
            };
            const center = {
                x: (faceLeft.x + faceRight.x) / 2,
                y: (faceLeft.y + faceRight.y) / 2
            };
            const faceHorizontalVec = {
                x: faceLeft.x - faceRight.x,
                y: faceLeft.y - faceRight.y
            };
            const faceVerticalVec = {
                x: faceHorizontalVec.y,
                y: - faceHorizontalVec.x
            };
            const size = {
                width: Math.sqrt(Math.pow(faceHorizontalVec.x, 2) + Math.pow(faceHorizontalVec.y, 2)),
                height: Math.sqrt(Math.pow(center.x - faceBottom.x, 2) + Math.pow(center.y - faceBottom.y, 2)) * 2
            };
            const angle = -Math.atan2(faceVerticalVec.x, faceVerticalVec.y);
            return {
                angle: angle,
                center: center,
                size: size,
                eyes: {
                    left: leftEye,
                    right: rightEye
                }
            };
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
            this.pienFlag = false;
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
        loadEyes: async function() {
            return new Promise((resolve, reject) => {
                const left = new Image();
                left.onload = () => {
                    const right = new Image();
                    right.onload = () => resolve([left, right]);
                    right.onerror = () => reject(e);
                    right.src = `img/${this.pienMode}_right.png`;
                }
                left.onerror = (e) => reject(e);
                left.src = `img/${this.pienMode}_left.png`;
            });
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
        this.loadMessage = "顔検出モデルを読み込んでいます...";
        await faceapi.nets.ssdMobilenetv1.loadFromUri('models/');
        await faceapi.nets.faceLandmark68Net.loadFromUri('models/');
        this.loadingFlag = false;
    }
});
